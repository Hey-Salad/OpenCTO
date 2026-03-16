import logging
import os
import secrets
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from anyway.sdk import Traceloop
from anyway.sdk.decorators import task, workflow


APP_NAME = os.getenv("OPENCTO_ANYWAY_SIDECAR_APP_NAME", "opencto-cloudbot-sidecar")
COLLECTOR_ENDPOINT = os.getenv(
    "OPENCTO_ANYWAY_SIDECAR_ENDPOINT",
    "https://trace-dev-collector.anyway.sh/",
)
ANYWAY_API_KEY = os.getenv("ANYWAY_API_KEY") or os.getenv("TRACELOOP_API_KEY")
SIDECAR_TOKEN = os.getenv("OPENCTO_SIDECAR_TOKEN", "").strip()
INGEST_ENDPOINT = os.getenv("OPENCTO_ANYWAY_INGEST_ENDPOINT", "https://trace-dev-collector.anyway.sh/v1/ingest")


def _parse_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return None


def _is_sandbox_collector(endpoint: str) -> bool:
    return "trace-dev-collector.anyway.sh" in endpoint


fallback_override = _parse_bool(os.getenv("OPENCTO_ANYWAY_FALLBACK_ENABLED"))
if fallback_override is not None:
    FALLBACK_ENABLED = fallback_override
else:
    # Sandbox collector handles OTLP exporter directly; disable fallback ingest noise by default.
    FALLBACK_ENABLED = not _is_sandbox_collector(COLLECTOR_ENDPOINT)

# Reduce noisy exporter failures when collector endpoint is unreachable.
os.environ.setdefault("TRACELOOP_METRICS_ENABLED", "false")
os.environ.setdefault("TRACELOOP_LOGGING_ENABLED", "false")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("opencto-anyway-sidecar")

init_error: str | None = None

if ANYWAY_API_KEY:
    try:
        Traceloop.init(
            app_name=APP_NAME,
            api_endpoint=COLLECTOR_ENDPOINT,
            headers={"authorization": f"Bearer {ANYWAY_API_KEY}"},
            disable_batch=False,
        )
        logger.info("Traceloop initialized for app_name=%s", APP_NAME)
    except Exception as exc:  # pragma: no cover
        init_error = str(exc)
        logger.exception("Failed to initialize Traceloop")
else:
    init_error = "Missing ANYWAY_API_KEY (or TRACELOOP_API_KEY)"
    logger.warning(init_error)


class TraceEvent(BaseModel):
    channel: str = Field(..., examples=["telegram"])
    scope: str = Field(..., examples=["telegram:12345"])
    text: str
    direction: str = Field(default="user")
    model: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )


@task(name="capture_message")
def capture_message(event: TraceEvent) -> dict[str, Any]:
    return {
        "channel": event.channel,
        "scope": event.scope,
        "direction": event.direction,
        "model": event.model,
        "text_len": len(event.text),
        "attributes": event.attributes,
        "timestamp": event.timestamp,
    }


@workflow(name="opencto_cloudbot_message")
def create_trace(event: TraceEvent) -> dict[str, Any]:
    return capture_message(event)


def ingest_fallback(event: TraceEvent) -> None:
    if not FALLBACK_ENABLED or not ANYWAY_API_KEY:
        return
    ts = event.timestamp or datetime.now(timezone.utc).isoformat()
    span_attributes: dict[str, Any] = {
        "service.name": APP_NAME,
        "app.name": APP_NAME,
        "channel": event.channel,
        "scope": event.scope,
        "direction": event.direction,
        "text_len": len(event.text),
    }
    if event.model:
        span_attributes["llm.model"] = event.model
    if event.attributes:
        for k, v in event.attributes.items():
            span_attributes[f"app.attr.{k}"] = v

    payload = {
        "traces": [
            {
                "trace_id": secrets.token_hex(16),
                "spans": [
                    {
                        "span_id": secrets.token_hex(8),
                        "name": "opencto.sidecar.message",
                        "start_time": ts,
                        "end_time": ts,
                        "attributes": span_attributes,
                        "status": {"code": "OK"},
                    }
                ],
            }
        ],
        "metrics": [],
    }
    body = json.dumps(payload).encode("utf-8")
    auth_variants = [f"Bearer {ANYWAY_API_KEY}", ANYWAY_API_KEY]
    last_http_error: int | None = None
    for auth_value in auth_variants:
      req = Request(
          INGEST_ENDPOINT,
          data=body,
          headers={
              "Content-Type": "application/json",
              "Authorization": auth_value,
          },
          method="POST",
      )
      try:
          with urlopen(req, timeout=10) as resp:
              if resp.status < 400:
                  return
              last_http_error = resp.status
      except HTTPError as exc:
          last_http_error = exc.code
      except URLError as exc:
          logger.warning("Fallback ingest network error=%s", exc.reason)
          return
    logger.warning("Fallback ingest failed after auth variants, status=%s", last_http_error)


app = FastAPI(title="OpenCTO Anyway Sidecar", version="0.1.0")


def _extract_bearer_token(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip()
    if not v:
        return None
    if v.lower().startswith("bearer "):
        return v[7:].strip() or None
    return v


def check_auth(token: str | None, authorization: str | None = None) -> None:
    if not SIDECAR_TOKEN:
        return
    provided = token or _extract_bearer_token(authorization)
    if provided != SIDECAR_TOKEN:
        raise HTTPException(
            status_code=401,
            detail="invalid sidecar token; use x-opencto-sidecar-token or Authorization: Bearer <token>",
        )


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": init_error is None,
        "service": "opencto-anyway-sidecar",
        "app_name": APP_NAME,
        "collector_endpoint": COLLECTOR_ENDPOINT,
        "ingest_endpoint": INGEST_ENDPOINT,
        "fallback_enabled": FALLBACK_ENABLED,
        "sdk_initialized": init_error is None,
        "error": init_error,
        "auth_required": bool(SIDECAR_TOKEN),
    }


@app.post("/trace/event")
def trace_event(
    event: TraceEvent,
    x_opencto_sidecar_token: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    check_auth(x_opencto_sidecar_token, authorization)
    if init_error:
        raise HTTPException(status_code=503, detail=init_error)
    result = create_trace(event)
    ingest_fallback(event)
    return {"ok": True, "trace": result}
