from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import HTTPException

from run_models import (
    ALLOWED_RUN_TRANSITIONS,
    ArtifactCreateRequest,
    ArtifactRecord,
    CompleteRunRequest,
    FailRunRequest,
    RunBundle,
    RunCreateRequest,
    RunCreateResponse,
    RunRecord,
    StepCreateRequest,
    StepRecord,
    new_id,
    now_iso,
)
from run_store import RunStore


class RunService:
    def __init__(self, store: RunStore, max_artifact_bytes: int = 200_000) -> None:
        self.store = store
        self.max_artifact_bytes = max_artifact_bytes
        self._subscribers: dict[str, list[asyncio.Queue[dict]]] = defaultdict(list)

    def create_run(self, payload: RunCreateRequest, idempotency_key: str | None = None) -> RunCreateResponse:
        if idempotency_key:
            existing = self.store.get_idempotent('create_run', idempotency_key)
            if existing:
                return RunCreateResponse(**existing)

        created_at = now_iso()
        run = RunRecord(
            run_id=new_id('run'),
            status='queued',
            created_at=created_at,
            updated_at=created_at,
            input=payload.goal,
            voice_model=payload.voice_model,
            reasoning_model=payload.reasoning_model,
        )
        self.store.create_run(run)
        response = RunCreateResponse(run_id=run.run_id, status=run.status)

        if idempotency_key:
            self.store.set_idempotent('create_run', idempotency_key, response.model_dump())

        self._publish(run.run_id, {'type': 'run.created', 'run': run.model_dump()})
        return response

    def get_bundle(self, run_id: str) -> RunBundle:
        run = self.store.get_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail='Run not found')
        return RunBundle(
            run=run,
            steps=self.store.list_steps(run_id),
            artifacts=self.store.list_artifacts(run_id),
        )

    def append_step(self, run_id: str, payload: StepCreateRequest) -> StepRecord:
        run = self.store.get_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail='Run not found')

        now = now_iso()
        step = StepRecord(
            step_id=new_id('step'),
            run_id=run_id,
            type=payload.type,
            status=payload.status,
            started_at=now,
            ended_at=now if payload.status in {'completed', 'failed'} else None,
            title=payload.title,
            details=payload.details,
        )
        self.store.append_step(step)

        if run.status == 'queued':
            self._transition(run, 'running')

        self._publish(run_id, {'type': 'step.created', 'step': step.model_dump()})
        return step

    def append_artifact(self, run_id: str, payload: ArtifactCreateRequest, idempotency_key: str | None = None) -> ArtifactRecord:
        run = self.store.get_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail='Run not found')

        size = len(payload.content.encode('utf-8'))
        if size > self.max_artifact_bytes:
            raise HTTPException(status_code=413, detail='Artifact too large')

        scope = f'artifact:{run_id}'
        if idempotency_key:
            existing = self.store.get_idempotent(scope, idempotency_key)
            if existing:
                return ArtifactRecord(**existing)

        artifact = ArtifactRecord(
            artifact_id=new_id('artifact'),
            run_id=run_id,
            step_id=payload.step_id,
            kind=payload.kind,
            title=payload.title,
            content=payload.content,
            metadata=payload.metadata,
            created_at=now_iso(),
        )
        self.store.append_artifact(artifact)

        if idempotency_key:
            self.store.set_idempotent(scope, idempotency_key, artifact.model_dump())

        self._publish(run_id, {'type': 'artifact.created', 'artifact': artifact.model_dump()})
        return artifact

    def complete_run(self, run_id: str, payload: CompleteRunRequest) -> RunRecord:
        run = self._require_run(run_id)
        if payload.summary:
            run.summary = payload.summary
        self._transition(run, 'completed')
        return run

    def fail_run(self, run_id: str, payload: FailRunRequest) -> RunRecord:
        run = self._require_run(run_id)
        if payload.summary:
            run.summary = payload.summary
        if payload.error:
            run.error = payload.error
        self._transition(run, 'failed')
        return run

    def _require_run(self, run_id: str) -> RunRecord:
        run = self.store.get_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail='Run not found')
        return run

    def _transition(self, run: RunRecord, target_status: str) -> None:
        if target_status not in ALLOWED_RUN_TRANSITIONS[run.status]:
            raise HTTPException(
                status_code=409,
                detail=f'Invalid status transition: {run.status} -> {target_status}',
            )
        run.status = target_status  # type: ignore[assignment]
        run.updated_at = now_iso()
        self.store.update_run(run)
        self._publish(run.run_id, {'type': 'run.updated', 'run': run.model_dump()})

    def subscribe(self, run_id: str) -> asyncio.Queue[dict]:
        queue: asyncio.Queue[dict] = asyncio.Queue()
        self._subscribers[run_id].append(queue)
        return queue

    def unsubscribe(self, run_id: str, queue: asyncio.Queue[dict]) -> None:
        subscribers = self._subscribers.get(run_id)
        if not subscribers:
            return
        if queue in subscribers:
            subscribers.remove(queue)
        if not subscribers:
            self._subscribers.pop(run_id, None)

    def _publish(self, run_id: str, event: dict) -> None:
        subscribers = self._subscribers.get(run_id, [])
        for q in subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass
