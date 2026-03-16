from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
from contextlib import suppress
from dataclasses import dataclass
from typing import Any, AsyncIterator, Protocol

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from agent_profiles import build_tool_declarations, compose_system_instruction

load_dotenv(override=True)

DEFAULT_ALLOWED_MODELS = [
    'gemini-2.5-flash-native-audio-preview-12-2025',
    'gemini-2.5-flash-native-audio-preview-09-2025',
]
DEFAULT_MODEL = DEFAULT_ALLOWED_MODELS[0]


@dataclass
class SessionClaims:
    sub: str
    email: str
    workspace_id: str
    model: str
    trace_id: str
    session_id: str
    exp: int
    iat: int


class LiveSession(Protocol):
    async def send_text(self, text: str) -> None: ...
    async def send_audio(self, data: bytes, mime_type: str) -> None: ...
    async def send_video(self, data: bytes, mime_type: str) -> None: ...
    async def send_tool_responses(self, responses: list[dict[str, Any]]) -> None: ...
    async def receive(self) -> AsyncIterator[Any]: ...


class LiveSessionContext(Protocol):
    async def __aenter__(self) -> LiveSession: ...
    async def __aexit__(self, exc_type, exc, tb) -> None: ...


class LiveSessionFactory(Protocol):
    def connect(self, model: str, setup_config: dict[str, Any]) -> LiveSessionContext: ...


class GoogleVertexLiveSession:
    def __init__(self, session: Any, types_module: Any) -> None:
        self._session = session
        self._types = types_module

    async def send_text(self, text: str) -> None:
        await self._session.send(input=text, end_of_turn=True)

    async def send_audio(self, data: bytes, mime_type: str) -> None:
        await self._session.send_realtime_input(
            audio=self._types.Blob(data=data, mime_type=mime_type),
        )

    async def send_video(self, data: bytes, mime_type: str) -> None:
        await self._session.send_realtime_input(
            video=self._types.Blob(data=data, mime_type=mime_type),
        )

    async def send_tool_responses(self, responses: list[dict[str, Any]]) -> None:
        if not responses:
            return
        function_responses = [
            self._types.FunctionResponse(
                id=str(item.get('id', '')),
                name=str(item.get('name', '')),
                response=item.get('response', {}) if isinstance(item.get('response'), dict) else {'output': item.get('response')},
            )
            for item in responses
        ]
        await self._session.send_tool_response(function_responses=function_responses)

    async def receive(self) -> AsyncIterator[Any]:
        async for response in self._session.receive():
            yield response


class GoogleVertexLiveSessionContext:
    def __init__(self, project_id: str, location: str, model: str, setup_config: dict[str, Any]) -> None:
        self._project_id = project_id
        self._location = location
        self._model = normalize_model_name(model)
        self._setup_config = setup_config
        self._client: Any | None = None
        self._context: Any | None = None
        self._types: Any | None = None

    async def __aenter__(self) -> GoogleVertexLiveSession:
        from google import genai
        from google.genai import types

        self._client = genai.Client(
            vertexai=True,
            project=self._project_id,
            location=self._location,
        )
        self._types = types
        config = build_live_connect_config(types, self._setup_config)
        self._context = self._client.aio.live.connect(model=self._model, config=config)
        session = await self._context.__aenter__()
        return GoogleVertexLiveSession(session, types)

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self._context is not None:
            await self._context.__aexit__(exc_type, exc, tb)
        if self._client is not None:
            close_fn = getattr(self._client.aio, 'aclose', None) or getattr(self._client.aio, 'close', None)
            if callable(close_fn):
                result = close_fn()
                if asyncio.iscoroutine(result):
                    await result


class GoogleVertexLiveFactory:
    def __init__(self, project_id: str, location: str) -> None:
        self._project_id = project_id
        self._location = location

    def connect(self, model: str, setup_config: dict[str, Any]) -> LiveSessionContext:
        return GoogleVertexLiveSessionContext(self._project_id, self._location, model, setup_config)


def create_app(
    live_factory: LiveSessionFactory | None = None,
    *,
    shared_secret: str | None = None,
    allowed_models: list[str] | None = None,
    default_model: str | None = None,
    project_id: str | None = None,
    location: str | None = None,
) -> FastAPI:
    effective_secret = shared_secret or os.getenv('GOOGLE_LIVE_SHARED_SECRET', '')
    effective_allowed_models = allowed_models or parse_allowed_models(os.getenv('GOOGLE_LIVE_ALLOWED_MODELS'))
    effective_default_model = normalize_model_name(default_model or os.getenv('GOOGLE_LIVE_DEFAULT_MODEL', DEFAULT_MODEL))
    effective_project_id = project_id or os.getenv('GOOGLE_CLOUD_PROJECT', '')
    effective_location = location or os.getenv('GOOGLE_CLOUD_LOCATION', 'us-central1')
    runtime = live_factory or GoogleVertexLiveFactory(effective_project_id, effective_location)

    app = FastAPI(title='OpenCTO Google Live Backend', version='0.1.0')
    app.add_middleware(
        CORSMiddleware,
        allow_origins=['*'],
        allow_credentials=False,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    @app.get('/health')
    async def health() -> dict[str, Any]:
        return {
            'ok': True,
            'service': 'opencto-google-live-backend',
            'projectConfigured': bool(effective_project_id),
            'location': effective_location,
        }

    @app.get('/v1/config')
    async def config() -> dict[str, Any]:
        return {
            'ok': True,
            'provider': 'google_vertex',
            'defaultModel': effective_default_model,
            'allowedModels': effective_allowed_models,
            'location': effective_location,
        }

    @app.websocket('/ws/live')
    async def live_ws(websocket: WebSocket) -> None:
        token = websocket.query_params.get('session_token') or extract_bearer_token(websocket.headers.get('authorization'))
        if not token:
            await websocket.close(code=4401, reason='Missing session token')
            return

        try:
            claims = verify_session_token(token, effective_secret)
        except ValueError as exc:
            await websocket.close(code=4401, reason=str(exc))
            return

        selected_model = select_allowed_model(claims.model, effective_allowed_models, effective_default_model)
        await websocket.accept()

        try:
            setup_payload = await asyncio.wait_for(receive_json_frame(websocket), timeout=10.0)
            setup_config = setup_payload.get('setup')
            if not isinstance(setup_config, dict):
                await websocket.send_json({'error': {'message': 'Expected an initial setup frame'}})
                await websocket.close(code=4400, reason='Expected setup frame')
                return

            async with runtime.connect(selected_model, setup_config) as session:
                await websocket.send_json({
                    'setupComplete': {
                        'provider': 'google_vertex',
                        'model': selected_model,
                        'workspaceId': claims.workspace_id,
                        'sessionId': claims.session_id,
                        'traceId': claims.trace_id,
                    },
                })

                client_task = asyncio.create_task(forward_client_messages(websocket, session))
                server_task = asyncio.create_task(forward_server_events(websocket, session))
                done, pending = await asyncio.wait(
                    {client_task, server_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )

                for task in pending:
                    task.cancel()
                for task in pending:
                    with suppress(asyncio.CancelledError):
                        await task
                for task in done:
                    exc = task.exception()
                    if exc and not isinstance(exc, WebSocketDisconnect):
                        raise exc
        except WebSocketDisconnect:
            return
        except Exception as exc:  # pragma: no cover - defensive runtime guard
            with suppress(Exception):
                await websocket.send_json({'error': {'message': f'Google live session failed: {exc}'}})
            with suppress(Exception):
                await websocket.close(code=1011, reason='Live session error')
            return

        with suppress(Exception):
            await websocket.close(code=1000)

    return app


async def forward_client_messages(websocket: WebSocket, session: LiveSession) -> None:
    while True:
        payload = await receive_json_frame(websocket)

        client_content = payload.get('clientContent')
        if isinstance(client_content, dict):
            text = extract_client_text(client_content)
            if text:
                await session.send_text(text)
            continue

        realtime_input = payload.get('realtimeInput')
        if isinstance(realtime_input, dict):
            audio = realtime_input.get('audio')
            if isinstance(audio, dict):
                decoded = decode_base64_blob(audio.get('data'))
                if decoded is not None:
                    await session.send_audio(decoded, str(audio.get('mimeType') or 'audio/pcm;rate=16000'))

            video = realtime_input.get('video')
            if isinstance(video, dict):
                decoded = decode_base64_blob(video.get('data'))
                if decoded is not None:
                    await session.send_video(decoded, str(video.get('mimeType') or 'image/jpeg'))
            continue

        tool_response = payload.get('toolResponse')
        if isinstance(tool_response, dict):
            function_responses = tool_response.get('functionResponses')
            if isinstance(function_responses, list):
                await session.send_tool_responses([
                    item for item in function_responses if isinstance(item, dict)
                ])


async def forward_server_events(websocket: WebSocket, session: LiveSession) -> None:
    async for event in session.receive():
        for frame in translate_server_event(event):
            await websocket.send_json(frame)


async def receive_json_frame(websocket: WebSocket) -> dict[str, Any]:
    raw = await websocket.receive_text()
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError('Expected a JSON object frame')
    return payload


def translate_server_event(event: Any) -> list[dict[str, Any]]:
    if isinstance(event, dict):
        return [event]

    frames: list[dict[str, Any]] = []
    server_content = getattr(event, 'server_content', None)
    if server_content is not None:
        content: dict[str, Any] = {}

        input_transcription = getattr(server_content, 'input_transcription', None)
        if getattr(input_transcription, 'text', None):
            content['inputTranscription'] = {
                'text': input_transcription.text,
                'finished': True,
            }

        output_transcription = getattr(server_content, 'output_transcription', None)
        if getattr(output_transcription, 'text', None):
            content['outputTranscription'] = {
                'text': output_transcription.text,
                'finished': True,
            }

        model_turn = getattr(server_content, 'model_turn', None)
        parts_payload: list[dict[str, Any]] = []
        for part in list(getattr(model_turn, 'parts', []) or []):
            translated_part: dict[str, Any] = {}
            if getattr(part, 'text', None):
                translated_part['text'] = part.text

            inline_data = getattr(part, 'inline_data', None)
            if inline_data is not None and getattr(inline_data, 'data', None):
                payload = inline_data.data
                if isinstance(payload, str):
                    encoded = payload
                else:
                    encoded = base64.b64encode(bytes(payload)).decode('ascii')
                translated_part['inlineData'] = {
                    'data': encoded,
                }
                mime_type = getattr(inline_data, 'mime_type', None)
                if mime_type:
                    translated_part['inlineData']['mimeType'] = mime_type

            if translated_part:
                parts_payload.append(translated_part)

        if parts_payload:
            content['modelTurn'] = {'parts': parts_payload}

        if getattr(server_content, 'interrupted', False):
            content['interrupted'] = True
        if getattr(server_content, 'turn_complete', False):
            content['turnComplete'] = True

        if content:
            frames.append({'serverContent': content})

    tool_call = getattr(event, 'tool_call', None)
    function_calls = list(getattr(tool_call, 'function_calls', []) or [])
    if function_calls:
        frames.append({
            'toolCall': {
                'functionCalls': [
                    {
                        'id': getattr(call, 'id', ''),
                        'name': getattr(call, 'name', ''),
                        'args': getattr(call, 'args', {}) or {},
                    }
                    for call in function_calls
                ],
            },
        })

    event_error = getattr(event, 'error', None)
    if event_error:
        frames.append({'error': {'message': str(event_error)}})

    return frames


def build_live_connect_config(types_module: Any, setup_config: dict[str, Any]) -> Any:
    config_args: dict[str, Any] = {
        'response_modalities': [types_module.Modality.AUDIO],
    }

    generation_config = first_dict(setup_config, 'generationConfig', 'generation_config')
    response_modalities = generation_config.get('responseModalities') or generation_config.get('response_modalities')
    if isinstance(response_modalities, list) and response_modalities:
        config_args['response_modalities'] = [
            coerce_modality(types_module, value)
            for value in response_modalities
            if isinstance(value, str)
        ]

    voice_name = extract_voice_name(generation_config)
    if voice_name:
        config_args['speech_config'] = types_module.SpeechConfig(
            voice_config=types_module.VoiceConfig(
                prebuilt_voice_config=types_module.PrebuiltVoiceConfig(voice_name=voice_name),
            ),
        )

    system_instruction = compose_system_instruction(
        extract_system_instruction_text(setup_config),
        extract_agent_profile(setup_config),
    )
    if system_instruction:
        config_args['system_instruction'] = types_module.Content(parts=[types_module.Part(text=system_instruction)])

    if has_any_key(setup_config, 'inputAudioTranscription', 'input_audio_transcription'):
        config_args['input_audio_transcription'] = types_module.AudioTranscriptionConfig()
    if has_any_key(setup_config, 'outputAudioTranscription', 'output_audio_transcription'):
        config_args['output_audio_transcription'] = types_module.AudioTranscriptionConfig()

    function_declarations = build_function_declarations(types_module, setup_config)
    if function_declarations:
        config_args['tools'] = [types_module.Tool(function_declarations=function_declarations)]

    return types_module.LiveConnectConfig(**config_args)


def build_function_declarations(types_module: Any, setup_config: dict[str, Any]) -> list[Any]:
    tools = setup_config.get('tools')
    tool_sources = tools if isinstance(tools, list) else [{'functionDeclarations': build_tool_declarations()}]

    declarations: list[Any] = []
    for tool in tool_sources:
        if not isinstance(tool, dict):
            continue
        function_declarations = tool.get('functionDeclarations') or tool.get('function_declarations') or []
        if not isinstance(function_declarations, list):
            continue
        for item in function_declarations:
            if not isinstance(item, dict):
                continue
            name = str(item.get('name') or '').strip()
            if not name:
                continue
            declarations.append(
                types_module.FunctionDeclaration(
                    name=name,
                    description=str(item.get('description') or ''),
                    parameters=item.get('parameters') or {'type': 'object', 'properties': {}, 'required': []},
                ),
            )
    return declarations


def extract_client_text(client_content: dict[str, Any]) -> str:
    turns = client_content.get('turns')
    if not isinstance(turns, list):
        return ''

    fragments: list[str] = []
    for turn in turns:
        if not isinstance(turn, dict):
            continue
        parts = turn.get('parts')
        if not isinstance(parts, list):
            continue
        for part in parts:
            if isinstance(part, dict) and isinstance(part.get('text'), str):
                text = part['text'].strip()
                if text:
                    fragments.append(text)
    return '\n'.join(fragments).strip()


def extract_system_instruction_text(setup_config: dict[str, Any]) -> str:
    system_instruction = first_dict(setup_config, 'systemInstruction', 'system_instruction')
    parts = system_instruction.get('parts')
    if not isinstance(parts, list):
        return ''
    for part in parts:
        if isinstance(part, dict) and isinstance(part.get('text'), str) and part.get('text', '').strip():
            return str(part['text']).strip()
    return ''


def extract_agent_profile(setup_config: dict[str, Any]) -> str:
    raw = setup_config.get('agentProfile') or setup_config.get('agent_profile') or 'dispatch'
    return str(raw).strip().lower() or 'dispatch'


def extract_voice_name(generation_config: dict[str, Any]) -> str:
    speech_config = first_dict(generation_config, 'speechConfig', 'speech_config')
    voice_config = first_dict(speech_config, 'voiceConfig', 'voice_config')
    prebuilt = first_dict(voice_config, 'prebuiltVoiceConfig', 'prebuilt_voice_config')
    return str(prebuilt.get('voiceName') or prebuilt.get('voice_name') or '').strip()


def first_dict(source: dict[str, Any], *keys: str) -> dict[str, Any]:
    for key in keys:
        value = source.get(key)
        if isinstance(value, dict):
            return value
    return {}


def has_any_key(source: dict[str, Any], *keys: str) -> bool:
    return any(key in source for key in keys)


def coerce_modality(types_module: Any, raw: str) -> Any:
    normalized = raw.strip().upper()
    if normalized == 'TEXT':
        return types_module.Modality.TEXT
    return types_module.Modality.AUDIO


def decode_base64_blob(raw: Any) -> bytes | None:
    if not isinstance(raw, str) or not raw:
        return None
    try:
        return base64.b64decode(raw)
    except Exception:
        return None


def extract_bearer_token(header: str | None) -> str | None:
    if not header or not header.startswith('Bearer '):
        return None
    return header[7:].strip() or None


def verify_session_token(token: str, secret: str) -> SessionClaims:
    if not secret:
        raise ValueError('Shared secret is not configured')

    parts = token.split('.')
    if len(parts) != 3:
        raise ValueError('Malformed session token')

    header_b64, payload_b64, signature_b64 = parts
    unsigned = f'{header_b64}.{payload_b64}'
    expected_signature = sign_value(unsigned, secret)
    if not hmac.compare_digest(signature_b64, expected_signature):
        raise ValueError('Invalid session token signature')

    payload = json.loads(base64_url_decode(payload_b64))
    if not isinstance(payload, dict):
        raise ValueError('Invalid session token payload')

    if payload.get('aud') != 'opencto-google-live':
        raise ValueError('Invalid session token audience')

    exp = int(payload.get('exp') or 0)
    if exp <= int(time.time()):
        raise ValueError('Session token has expired')

    return SessionClaims(
        sub=str(payload.get('sub') or ''),
        email=str(payload.get('email') or ''),
        workspace_id=str(payload.get('workspaceId') or 'default'),
        model=normalize_model_name(str(payload.get('model') or DEFAULT_MODEL)),
        trace_id=str(payload.get('traceId') or ''),
        session_id=str(payload.get('sessionId') or ''),
        exp=exp,
        iat=int(payload.get('iat') or 0),
    )


def sign_value(value: str, secret: str) -> str:
    digest = hmac.new(secret.encode('utf-8'), value.encode('utf-8'), hashlib.sha256).digest()
    return base64_url_encode(digest)


def base64_url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('ascii').rstrip('=')


def base64_url_decode(data: str) -> bytes:
    padding = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(f'{data}{padding}')


def normalize_model_name(model: str) -> str:
    normalized = model.strip().replace('models/', '')
    return normalized or DEFAULT_MODEL


def parse_allowed_models(raw: str | None) -> list[str]:
    if not raw:
        return list(DEFAULT_ALLOWED_MODELS)
    values = [normalize_model_name(item) for item in raw.split(',') if item.strip()]
    return values or list(DEFAULT_ALLOWED_MODELS)


def select_allowed_model(requested: str, allowed_models: list[str], default_model: str) -> str:
    normalized = normalize_model_name(requested)
    if normalized in allowed_models:
        return normalized
    if default_model in allowed_models:
        return default_model
    return allowed_models[0]


app = create_app()
