# Anyway Integration Support Handoff (OpenCTO)

Date: 2026-03-05  
Owner: OpenCTO Team  
Service: `opencto-cloudbot-worker` + Python sidecar

## Summary

We implemented Anyway tracing in two paths:

1. Direct Worker emit path (Cloudflare Worker -> Anyway ingest-style payload)
2. Python sidecar path (Worker -> sidecar -> `anyway-sdk` / OTLP exporter)

Current blocker is **Anyway authorization/entitlement and/or endpoint availability**:

- API requests to `https://api.anyway.sh/v1/*` return `403`
- Collector endpoint `collector.anyway.sh` is unreachable from this host (`connection refused`)

## What We Built

## 1) Cloudflare Worker integration

- Worker service: `opencto-cloudbot-worker`
- Runtime channels: Telegram, Slack, Infobip WhatsApp/SMS
- Emits spans around:
  - webhook handling
  - RAG retrieval (lexical/semantic)
  - OpenAI response call
- Fail-open telemetry behavior (no user-facing disruption on telemetry failures)

Health endpoint confirms active config:

- `GET https://opencto-cloudbot-worker.heysalad-o.workers.dev/health`
- includes:
  - `anyway_enabled`
  - `anyway_endpoint`
  - `sidecar_enabled`
  - `sidecar_url`

## 2) Python sidecar integration

- Public URL: `https://anyway-sdk-sidecar.opencto.works`
- Endpoint:
  - `POST /trace/event` (token-protected with `x-opencto-sidecar-token`)
  - `GET /health`
- Framework: FastAPI + `anyway-sdk`
- Sidecar currently running as user services:
  - `opencto-anyway-sidecar.service`
  - `opencto-anyway-tunnel.service`

## Environment / Deployment

## Sidecar systemd

- Env file: `~/.config/opencto-anyway-sidecar.env`
- Services:
  - `~/.config/systemd/user/opencto-anyway-sidecar.service`
  - `~/.config/systemd/user/opencto-anyway-tunnel.service`
- Tunnel config:
  - `opencto/opencto-cloudbot-worker/sidecar/tunnel.yml`

## Worker vars/secrets used

- Vars:
  - `OPENCTO_ANYWAY_ENABLED=true`
  - `OPENCTO_ANYWAY_ENDPOINT=https://api.anyway.sh/v1/ingest`
  - `OPENCTO_ANYWAY_APP_NAME=opencto-cloudbot-worker`
  - `OPENCTO_SIDECAR_ENABLED=true`
  - `OPENCTO_SIDECAR_URL=https://anyway-sdk-sidecar.opencto.works/trace/event`
- Secret:
  - `OPENCTO_SIDECAR_TOKEN`

## Verification Results

## A) Worker -> sidecar path

- `POST /trace/event` to sidecar returns `200 OK`
- Sidecar logs confirm requests received

Conclusion: **forwarding path is healthy**.

## B) Sidecar SDK exporter

Observed log patterns:

- gRPC metadata error fixed (`Authorization` uppercase issue)
- After fix, exporter still fails:
  - `StatusCode.UNAVAILABLE` (gRPC path)
  - HTTP exporter retries with:
    - `Failed to establish a new connection: [Errno 111] Connection refused`

Example host-level network checks:

- `collector.anyway.sh:4317` -> connection refused
- `collector.anyway.sh:443` -> connection refused
- `api.anyway.sh:443` -> reachable

Conclusion: **collector endpoint not reachable from this host/network**.

## C) Anyway REST API auth checks

With provided key(s), all return `403`:

- `POST https://api.anyway.sh/v1/ingest`
- `GET https://api.anyway.sh/v1/traces?limit=1`

Conclusion: **key permissions/scope likely insufficient (or sandbox-only restrictions)**.

## Commands We Ran (Repro)

```bash
# Ingest check
curl -i -X POST https://api.anyway.sh/v1/ingest \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"traces":[],"metrics":[]}'

# Trace query check
curl -i "https://api.anyway.sh/v1/traces?limit=1" \
  -H "Authorization: Bearer <API_KEY>"

# Host connectivity checks
curl -I https://collector.anyway.sh
curl -I https://api.anyway.sh

# TCP checks
bash -lc 'cat < /dev/null > /dev/tcp/collector.anyway.sh/4317'
bash -lc 'cat < /dev/null > /dev/tcp/collector.anyway.sh/443'
bash -lc 'cat < /dev/null > /dev/tcp/api.anyway.sh/443'
```

## What We Need From Anyway Support

1. Confirm required key type for server-side ingest/query:
   - should include `write:traces` + `read:traces`
2. Confirm whether sandbox/test keys can call:
   - `POST /v1/ingest`
   - `GET /v1/traces`
3. Confirm if our keys/project are restricted (cause of `403`)
4. Confirm collector endpoint/port for our account/network
   - current docs suggest `collector.anyway.sh`
   - from this host, collector is connection refused
5. Provide recommended endpoint fallback strategy if collector unavailable

## Security Notes

- Multiple test keys were used during troubleshooting.
- All exposed test keys should be rotated/revoked.
- No production secrets are included in this document.

## Current Status

- OpenCTO implementation is complete and operational up to sidecar ingestion.
- Blocked only on Anyway-side authorization/collector access.
