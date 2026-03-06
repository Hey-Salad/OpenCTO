# Anyway SDK Incident Report + Fix Recommendations

Date: 2026-03-05  
Owner: OpenCTO (`opencto-cloudbot-worker` + `sidecar`)

## 1) Executive Summary

OpenCTO's sidecar and SDK integration are functioning locally, but traces are not visible in Anyway due to two upstream blockers:

1. `collector.anyway.sh` is unreachable from this server (`connection refused` / gRPC `UNAVAILABLE`).
2. Anyway REST endpoints return `403` for the current sandbox key (`/v1/ingest`, `/v1/traces`, `/v1/projects`, `/v1/metrics`).

This is not a local tracing pipeline bug. It is an upstream access/entitlement issue (network path and/or key scope).

## 2) Symptoms Observed

- Sidecar accepts events (`POST /trace/event` -> `200`).
- Sidecar health is green (`sdk_initialized=true`).
- SDK decorators execute (`@workflow`, `@task`) and produce spans locally.
- Export fails:
  - HTTP exporter: `connection refused` to `collector.anyway.sh:443`
  - gRPC exporter: `StatusCode.UNAVAILABLE` to `collector.anyway.sh:4317`
- Fallback ingest fails with HTTP `403`.

## 3) Reproduction Commands

```bash
# A) Sidecar health
curl -sS http://127.0.0.1:8788/health

# B) Sidecar trace event (expected 200)
curl -sS -X POST http://127.0.0.1:8788/trace/event \
  -H "x-opencto-sidecar-token: $OPENCTO_SIDECAR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel":"manual","scope":"test","text":"ping"}'

# C) Collector connectivity checks (failing)
# returns connection refused from this host
bash -lc "</dev/tcp/collector.anyway.sh/443"
bash -lc "</dev/tcp/collector.anyway.sh/4317"

# D) API endpoint reachable but key denied
bash -lc "</dev/tcp/api.anyway.sh/443"   # reachable
curl -i https://api.anyway.sh/v1/projects -H "Authorization: Bearer $ANYWAY_API_KEY"  # 403
curl -i https://api.anyway.sh/v1/traces?limit=1 -H "Authorization: Bearer $ANYWAY_API_KEY"  # 403
curl -i -X POST https://api.anyway.sh/v1/ingest \
  -H "Authorization: Bearer $ANYWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"traces":[],"metrics":[]}'  # 403
```

## 4) Root-Cause Hypothesis

Most likely one or both:

1. **Collector path issue** for this account/network/region (endpoint reachable elsewhere, refused here).
2. **Sandbox key entitlement issue** (key valid format, but lacks required permissions for ingest/query, leading to 403).

## 5) Local Fixes Implemented

## Fix A: Sidecar auth compatibility

Problem: some clients used `Authorization: Bearer ...` but sidecar expected only `x-opencto-sidecar-token`.

Implemented in `sidecar/app.py`:
- Accept either header style.
- Keep strict token check.
- Return clearer 401 message.

Patch summary:

```python
# new helper
_extract_bearer_token(...)

# updated auth
check_auth(x_opencto_sidecar_token, authorization)
```

This removes false negatives during manual testing and integration.

## Fix B: Keep fail-open behavior

Current behavior preserved:
- If export to collector fails, sidecar still returns 200 to caller.
- This avoids breaking production chat flows due to telemetry outages.

## 6) Recommended Next Fixes (Code + Ops)

## Recommendation 1: Add explicit diagnostics endpoint

Add `GET /diag/connectivity` in sidecar to run lightweight checks and return:
- collector DNS result
- collector TCP 443/4317 reachability
- API 443 reachability
- last fallback ingest status

Suggested shape:

```python
@app.get("/diag/connectivity")
def diag_connectivity() -> dict[str, Any]:
    return {
        "collector": {"host": "collector.anyway.sh", "tcp_443": False, "tcp_4317": False},
        "api": {"host": "api.anyway.sh", "tcp_443": True},
        "last_fallback_status": 403,
    }
```

## Recommendation 2: Surface delivery state in worker health

Update Worker `/health` to include sidecar delivery counters:
- `sidecar_events_sent`
- `sidecar_events_failed`
- `last_sidecar_status`

This will quickly separate "event generation" from "vendor ingestion" failures.

## Recommendation 3: Auto-degrade to REST-only mode when collector is down

If collector is unreachable for N minutes:
- temporarily suppress SDK exporter noise
- rely on fallback ingest only
- periodically retry collector path

Pseudo-code:

```python
if collector_consecutive_failures > threshold:
    collector_mode_enabled = False

if collector_mode_enabled:
    create_trace(event)

ingest_fallback(event)
```

## Recommendation 4: Support-friendly error payload logging

Log structured non-secret fields for each failure:
- endpoint
- transport (grpc/http)
- status code / exception class
- trace id (local)
- request timestamp

Do not log full keys or token values.

## 7) What Anyway Support Must Confirm

1. Is `collector.anyway.sh` the correct endpoint for this account/tier from this region?
2. Are sandbox keys allowed to call:
   - `POST /v1/ingest`
   - `GET /v1/traces`
   - `GET /v1/projects`
3. What exact permissions/scopes are required for SDK + REST fallback?
4. Is our source IP/account blocked or not provisioned for collector access?

## 8) Final Status

- OpenCTO integration: implemented and receiving events.
- Blocking issue: upstream Anyway connectivity/authorization.
- Local code has been hardened to reduce auth confusion and improve operability while waiting for Anyway-side resolution.
