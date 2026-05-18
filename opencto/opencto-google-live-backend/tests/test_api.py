import asyncio
import base64
import hashlib
import hmac
import json
import pathlib
import sys
import time

from fastapi.testclient import TestClient

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app import create_app


class FakeLiveSession:
    def __init__(self) -> None:
        self.audio_chunks: list[tuple[bytes, str]] = []
        self.tool_responses: list[dict] = []
        self._queue: asyncio.Queue[dict | None] = asyncio.Queue()
        self._queue.put_nowait({'serverContent': {'outputTranscription': {'text': 'ready', 'finished': True}}})

    async def send_text(self, text: str) -> None:
        await self._queue.put({'serverContent': {'outputTranscription': {'text': f'echo:{text}', 'finished': True}}})

    async def send_audio(self, data: bytes, mime_type: str) -> None:
        self.audio_chunks.append((data, mime_type))

    async def send_video(self, data: bytes, mime_type: str) -> None:
        self.audio_chunks.append((data, mime_type))

    async def send_tool_responses(self, responses: list[dict]) -> None:
        self.tool_responses.extend(responses)
        await self._queue.put({'serverContent': {'turnComplete': True}})

    async def receive(self):
        while True:
            event = await self._queue.get()
            if event is None:
                break
            yield event

    async def close(self) -> None:
        await self._queue.put(None)


class FakeLiveContext:
    def __init__(self, session: FakeLiveSession) -> None:
        self.session = session

    async def __aenter__(self) -> FakeLiveSession:
        return self.session

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.session.close()


class FakeLiveFactory:
    def __init__(self) -> None:
        self.last_model: str | None = None
        self.last_setup: dict | None = None
        self.session = FakeLiveSession()

    def connect(self, model: str, setup_config: dict):
        self.last_model = model
        self.last_setup = setup_config
        return FakeLiveContext(self.session)


def make_token(secret: str, model: str = 'gemini-2.5-flash-native-audio-preview-12-2025') -> str:
    header = {'alg': 'HS256', 'typ': 'JWT'}
    now = int(time.time())
    payload = {
        'iss': 'opencto-api-worker',
        'aud': 'opencto-google-live',
        'sub': 'user-demo',
        'email': 'demo@opencto.works',
        'workspaceId': 'default',
        'model': model,
        'traceId': 'trace-demo',
        'sessionId': 'session-demo',
        'iat': now,
        'exp': now + 300,
    }
    unsigned = f'{encode_json(header)}.{encode_json(payload)}'
    signature = hmac.new(secret.encode('utf-8'), unsigned.encode('utf-8'), hashlib.sha256).digest()
    return f'{unsigned}.{base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")}'


def encode_json(value: dict) -> str:
    raw = json.dumps(value, separators=(',', ':')).encode('utf-8')
    return base64.urlsafe_b64encode(raw).decode('ascii').rstrip('=')


def test_health():
    app = create_app(
        live_factory=FakeLiveFactory(),
        shared_secret='test-secret',
        project_id='demo-project',
        location='us-central1',
    )
    client = TestClient(app)
    res = client.get('/health')
    assert res.status_code == 200
    assert res.json()['ok'] is True


def test_websocket_bridges_setup_text_audio_and_tool_responses():
    factory = FakeLiveFactory()
    app = create_app(
        live_factory=factory,
        shared_secret='test-secret',
        project_id='demo-project',
        location='us-central1',
    )
    client = TestClient(app)
    token = make_token('test-secret')

    with client.websocket_connect(f'/ws/live?session_token={token}') as ws:
        ws.send_json({
            'setup': {
                'systemInstruction': {'parts': [{'text': 'Help with deploys'}]},
                'inputAudioTranscription': {},
                'outputAudioTranscription': {},
            },
        })

        setup = ws.receive_json()
        assert setup['setupComplete']['provider'] == 'google_vertex'
        assert setup['setupComplete']['model'] == 'gemini-2.5-flash-native-audio-preview-12-2025'

        ready = ws.receive_json()
        assert ready['serverContent']['outputTranscription']['text'] == 'ready'

        ws.send_json({
            'clientContent': {
                'turns': [
                    {'role': 'user', 'parts': [{'text': 'ship it'}]},
                ],
                'turnComplete': True,
            },
        })
        echoed = ws.receive_json()
        assert echoed['serverContent']['outputTranscription']['text'] == 'echo:ship it'

        audio_bytes = b'pcm-chunk'
        ws.send_json({
            'realtimeInput': {
                'audio': {
                    'data': base64.b64encode(audio_bytes).decode('ascii'),
                    'mimeType': 'audio/pcm;rate=16000',
                },
            },
        })
        assert factory.session.audio_chunks[0] == (audio_bytes, 'audio/pcm;rate=16000')

        ws.send_json({
            'toolResponse': {
                'functionResponses': [
                    {'id': 'call-1', 'name': 'list_github_orgs', 'response': {'ok': True}},
                ],
            },
        })
        turn_complete = ws.receive_json()
        assert turn_complete['serverContent']['turnComplete'] is True
        assert factory.session.tool_responses[0]['name'] == 'list_github_orgs'
        assert factory.last_setup is not None
        assert factory.last_model == 'gemini-2.5-flash-native-audio-preview-12-2025'
