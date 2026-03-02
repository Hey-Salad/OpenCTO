from __future__ import annotations

import asyncio
import json
import os
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from run_models import (
    ArtifactCreateRequest,
    ChatRequest,
    CompleteRunRequest,
    FailRunRequest,
    RunCreateRequest,
    StepCreateRequest,
)
from run_service import RunService
from run_store import create_store

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_BASE_URL = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4.1-mini')


class RateLimiter:
    def __init__(self, limit: int = 60, window_seconds: int = 60) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.time()
        q = self._hits[key]
        while q and (now - q[0]) > self.window_seconds:
            q.popleft()
        if len(q) >= self.limit:
            raise HTTPException(status_code=429, detail='Rate limit exceeded')
        q.append(now)


def create_app(service: RunService | None = None) -> FastAPI:
    app = FastAPI(title='OpenCTO Voice Backend', version='0.2.0')
    run_service = service or RunService(create_store())
    rate_limiter = RateLimiter()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=['*'],
        allow_credentials=False,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    def _client_key(request: Request) -> str:
        return (request.client.host if request.client else 'unknown') + ':' + request.url.path

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                'ok': False,
                'error': {
                    'code': exc.status_code,
                    'message': str(exc.detail),
                },
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={
                'ok': False,
                'error': {
                    'code': 500,
                    'message': f'Unhandled server error: {exc}',
                },
            },
        )

    @app.get('/health')
    async def health() -> dict:
        return {
            'ok': True,
            'service': 'opencto-voice-backend',
            'time': datetime.now(timezone.utc).isoformat(),
        }

    @app.post('/v1/respond')
    async def respond(payload: ChatRequest) -> dict:
        if not OPENAI_API_KEY:
            raise HTTPException(status_code=500, detail='OPENAI_API_KEY is not configured')

        body = {
            'model': OPENAI_MODEL,
            'messages': [
                {'role': 'system', 'content': payload.system or 'You are a helpful assistant.'},
                {'role': 'user', 'content': payload.text},
            ],
            'temperature': 0.2,
        }

        headers = {
            'Authorization': f'Bearer {OPENAI_API_KEY}',
            'Content-Type': 'application/json',
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(f'{OPENAI_BASE_URL}/v1/chat/completions', headers=headers, json=body)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f'Upstream request failed: {exc}') from exc

        if res.status_code >= 400:
            raise HTTPException(status_code=502, detail=f'Upstream error {res.status_code}: {res.text}')

        data = res.json()
        text = data.get('choices', [{}])[0].get('message', {}).get('content', '')
        return {'ok': True, 'text': text}

    @app.post('/v1/runs')
    async def create_run(request: Request, payload: RunCreateRequest):
        rate_limiter.check(_client_key(request))
        idem = request.headers.get('Idempotency-Key')
        created = run_service.create_run(payload, idem)
        return {'ok': True, **created.model_dump()}

    @app.get('/v1/runs/{run_id}')
    async def get_run(run_id: str):
        bundle = run_service.get_bundle(run_id)
        return {'ok': True, **bundle.model_dump()}

    @app.get('/v1/runs/{run_id}/events')
    async def stream_run_events(run_id: str):
        run_service.get_bundle(run_id)
        queue = run_service.subscribe(run_id)

        async def event_generator():
            try:
                yield f"event: heartbeat\ndata: {json.dumps({'ok': True, 'run_id': run_id})}\n\n"
                while True:
                    try:
                        event = await asyncio.wait_for(queue.get(), timeout=15.0)
                        yield f"event: update\ndata: {json.dumps(event)}\n\n"
                    except asyncio.TimeoutError:
                        yield ': keepalive\n\n'
            except asyncio.CancelledError:
                raise
            finally:
                run_service.unsubscribe(run_id, queue)

        return StreamingResponse(event_generator(), media_type='text/event-stream')

    @app.post('/v1/runs/{run_id}/steps')
    async def add_step(run_id: str, request: Request, payload: StepCreateRequest):
        rate_limiter.check(_client_key(request))
        step = run_service.append_step(run_id, payload)
        return {'ok': True, 'step': step.model_dump()}

    @app.post('/v1/runs/{run_id}/artifacts')
    async def add_artifact(run_id: str, request: Request, payload: ArtifactCreateRequest):
        rate_limiter.check(_client_key(request))
        idem = request.headers.get('Idempotency-Key')
        artifact = run_service.append_artifact(run_id, payload, idem)
        return {'ok': True, 'artifact': artifact.model_dump()}

    @app.post('/v1/runs/{run_id}/complete')
    async def complete_run(run_id: str, request: Request, payload: CompleteRunRequest):
        rate_limiter.check(_client_key(request))
        run = run_service.complete_run(run_id, payload)
        return {'ok': True, 'run': run.model_dump()}

    @app.post('/v1/runs/{run_id}/fail')
    async def fail_run(run_id: str, request: Request, payload: FailRunRequest):
        rate_limiter.check(_client_key(request))
        run = run_service.fail_run(run_id, payload)
        return {'ok': True, 'run': run.model_dump()}

    return app


app = create_app()
