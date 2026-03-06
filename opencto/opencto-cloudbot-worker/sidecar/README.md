# OpenCTO Anyway Python Sidecar

FastAPI sidecar that initializes `anyway-sdk` (`Traceloop.init`) and receives trace events from OpenCTO workers.

Use this service when you want OpenCTO runtime events mirrored into Anyway/Traceloop with a dedicated ingestion endpoint.

## Prerequisites

- Python `>= 3.10`
- `pip`
- `venv`

## Quick Start

### 1) Install dependencies

```bash
cd opencto/opencto-cloudbot-worker/sidecar
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Configure environment

Required:

```bash
export ANYWAY_API_KEY="<your-anyway-api-key>"
```

Optional:

```bash
export OPENCTO_ANYWAY_SIDECAR_APP_NAME="opencto-cloudbot-sidecar"
export OPENCTO_ANYWAY_SIDECAR_ENDPOINT="https://trace-dev-collector.anyway.sh/"
export OPENCTO_SIDECAR_TOKEN="<shared-secret>"
export OPENCTO_ANYWAY_FALLBACK_ENABLED="false"
export OPENCTO_ANYWAY_INGEST_ENDPOINT="https://trace-dev-collector.anyway.sh/v1/ingest"
```

Collector note:

- For `trace-dev-collector.anyway.sh`, keep fallback disabled (`OPENCTO_ANYWAY_FALLBACK_ENABLED=false`).

### 3) Run

```bash
uvicorn app:app --host 0.0.0.0 --port 8788
```

## Health Check

```bash
curl -sS http://127.0.0.1:8788/health
```

## Send Test Event

```bash
curl -sS -X POST http://127.0.0.1:8788/trace/event \
  -H "Content-Type: application/json" \
  -H "x-opencto-sidecar-token: <shared-secret>" \
  -d '{
    "channel":"telegram",
    "scope":"telegram:1110137791",
    "text":"hello from sidecar",
    "direction":"user",
    "model":"gpt-4.1-mini",
    "attributes":{"source":"cloudbot-worker"}
  }'
```

## Auth Options

Preferred:

- `x-opencto-sidecar-token: <shared-secret>`

Also supported:

- `Authorization: Bearer <shared-secret>`

## Integration Checklist

1. Sidecar is reachable from worker runtime.
2. Worker has matching `OPENCTO_SIDECAR_TOKEN`.
3. Worker has `OPENCTO_SIDECAR_ENABLED=true` and correct `OPENCTO_SIDECAR_URL`.
4. Sidecar `/health` and `/trace/event` succeed with expected auth header.

## How-To Guides

### How to run sidecar and verify ingestion

1. Create and activate virtualenv.
2. Install dependencies from `requirements.txt`.
3. Set `ANYWAY_API_KEY` and optional sidecar token.
4. Start server with `uvicorn app:app --host 0.0.0.0 --port 8788`.
5. Check `/health`.
6. Post a sample `/trace/event` payload and verify success.

### How to connect CloudBot worker to this sidecar

1. Set worker `OPENCTO_SIDECAR_ENABLED=true`.
2. Set worker `OPENCTO_SIDECAR_URL` to `http://<sidecar-host>:8788/trace/event`.
3. Set matching `OPENCTO_SIDECAR_TOKEN` on both services.
4. Trigger one bot response and confirm event appears in sidecar logs/collector.

## References (Chicago 17th, Bibliography)

FastAPI. n.d. "FastAPI Documentation." Accessed March 6, 2026. https://fastapi.tiangolo.com/.

Traceloop. n.d. "Traceloop Documentation." Accessed March 6, 2026. https://docs.traceloop.com/.

Uvicorn. n.d. "Uvicorn Documentation." Accessed March 6, 2026. https://www.uvicorn.org/.
