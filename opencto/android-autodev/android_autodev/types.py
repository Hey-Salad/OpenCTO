from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class Step:
    step_id: str
    action: str
    args: Dict[str, Any] = field(default_factory=dict)
    risk_tier: str = "R0"
    retries: int = 0
    timeout_sec: int = 30


@dataclass
class Task:
    task_id: str
    goal: str
    steps: List[Step]
    created_at: str
    status: str = "queued"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StepResult:
    ok: bool
    output: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    duration_ms: int = 0
