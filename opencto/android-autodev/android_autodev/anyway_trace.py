from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict
from urllib import request


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_bool(raw: str | None, default: bool) -> bool:
    if raw is None:
        return default
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default


class AnywayTracer:
    """Fail-open trace emitter for android-autodev.

    This sends compact trace events to the OpenCTO sidecar-compatible endpoint.
    It never raises from network errors.
    """

    def __init__(
        self,
        *,
        enabled: bool,
        endpoint: str,
        token: str,
        model: str,
        timeout_sec: int,
        scope: str,
        trace_id: str,
    ) -> None:
        self.enabled = enabled
        self.endpoint = endpoint
        self.token = token
        self.model = model
        self.timeout_sec = timeout_sec
        self.scope = scope
        self.trace_id = trace_id

    @classmethod
    def from_env(cls, *, scope: str, trace_id: str = "") -> "AnywayTracer":
        endpoint = os.getenv("AUTODEV_ANYWAY_ENDPOINT", "http://127.0.0.1:8788/trace/event").strip()
        token = os.getenv("AUTODEV_ANYWAY_TOKEN", "").strip()
        enabled = _parse_bool(os.getenv("AUTODEV_ANYWAY_ENABLED"), default=False)
        model = os.getenv("AUTODEV_TRACE_MODEL", "android-autodev")

        timeout_raw = os.getenv("AUTODEV_ANYWAY_TIMEOUT_SEC", "4").strip()
        try:
            timeout_sec = max(1, min(30, int(timeout_raw)))
        except Exception:
            timeout_sec = 4

        return cls(
            enabled=enabled,
            endpoint=endpoint,
            token=token,
            model=model,
            timeout_sec=timeout_sec,
            scope=scope,
            trace_id=trace_id or uuid.uuid4().hex,
        )

    def emit(self, event_type: str, *, text: str, attributes: Dict[str, Any] | None = None) -> None:
        if not self.enabled:
            return

        payload = {
            "channel": "android-autodev",
            "scope": self.scope,
            "text": text,
            "direction": "assistant",
            "model": self.model,
            "timestamp": _now_iso(),
            "attributes": {
                "trace_id": self.trace_id,
                "event_type": event_type,
                **(attributes or {}),
            },
        }

        headers = {
            "Content-Type": "application/json",
        }
        if self.token:
            headers["x-opencto-sidecar-token"] = self.token

        req = request.Request(
            self.endpoint,
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers=headers,
        )

        try:
            with request.urlopen(req, timeout=self.timeout_sec):
                return
        except Exception:
            # Fail open: tracing must not block task execution.
            return
