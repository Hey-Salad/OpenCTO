from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

RunStatus = Literal['queued', 'running', 'waiting_human', 'completed', 'failed', 'canceled']
StepStatus = Literal['queued', 'running', 'completed', 'failed']
StepType = Literal['plan', 'tool_call', 'command', 'code_gen', 'deploy', 'review', 'artifact']
ArtifactKind = Literal['code', 'command', 'output', 'diff', 'log', 'diagram', 'url', 'file']


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f'{prefix}_{uuid4().hex}'


ALLOWED_RUN_TRANSITIONS: dict[str, set[str]] = {
    'queued': {'running', 'failed', 'canceled'},
    'running': {'waiting_human', 'completed', 'failed', 'canceled'},
    'waiting_human': {'running', 'failed', 'canceled'},
    'completed': set(),
    'failed': set(),
    'canceled': set(),
}


class ChatRequest(BaseModel):
    text: str
    system: str | None = 'You are a concise, helpful CTO copilot.'


class RunCreateRequest(BaseModel):
    goal: str = Field(min_length=1, max_length=8000)
    voice_model: str | None = None
    reasoning_model: str | None = None


class RunCreateResponse(BaseModel):
    run_id: str
    status: RunStatus


class StepCreateRequest(BaseModel):
    type: StepType
    status: StepStatus
    title: str = Field(min_length=1, max_length=300)
    details: dict = Field(default_factory=dict)


class ArtifactCreateRequest(BaseModel):
    kind: ArtifactKind
    title: str = Field(min_length=1, max_length=300)
    content: str
    step_id: str | None = None
    metadata: dict = Field(default_factory=dict)


class CompleteRunRequest(BaseModel):
    summary: str | None = None


class FailRunRequest(BaseModel):
    summary: str | None = None
    error: str | None = None


class RunRecord(BaseModel):
    run_id: str
    status: RunStatus
    created_at: str
    updated_at: str
    input: str
    voice_model: str | None = None
    reasoning_model: str | None = None
    summary: str | None = None
    error: str | None = None


class StepRecord(BaseModel):
    step_id: str
    run_id: str
    type: StepType
    status: StepStatus
    started_at: str
    ended_at: str | None = None
    title: str
    details: dict = Field(default_factory=dict)


class ArtifactRecord(BaseModel):
    artifact_id: str
    run_id: str
    step_id: str | None = None
    kind: ArtifactKind
    title: str
    content: str
    metadata: dict = Field(default_factory=dict)
    created_at: str


class RunBundle(BaseModel):
    run: RunRecord
    steps: list[StepRecord]
    artifacts: list[ArtifactRecord]
