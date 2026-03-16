# OpenCTO Anyway Python Sidecar

FastAPI sidecar that initializes `anyway-sdk` (`Traceloop.init`) and exposes a simple HTTP endpoint to create workflow/task traces.

## 1) Install

```bash
cd sidecar
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2) Configure

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

Notes:
- For `trace-dev-collector.anyway.sh`, keep `OPENCTO_ANYWAY_FALLBACK_ENABLED=false`.
- The sidecar already defaults fallback off for this sandbox collector if the env var is unset.

## 3) Run

```bash
uvicorn app:app --host 0.0.0.0 --port 8788
```

## 4) Test

Health:

```bash
curl -sS http://127.0.0.1:8788/health
```

Send event:

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

Auth note:
- Preferred: `x-opencto-sidecar-token: <shared-secret>`
- Also accepted: `Authorization: Bearer <shared-secret>`
