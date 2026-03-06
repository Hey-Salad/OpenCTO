# OpenAI, Cloudflare, and Traceloop Implementation Guide

Version: v1.0  
Date: March 6, 2026  
Scope: OpenCTO codebase implementation map and rollout guidance

## Purpose

This document explains how OpenCTO currently implements OpenAI and Cloudflare workflows, and how to implement Traceloop in a way that fits the current architecture.

It is organized by task tracks:

- Task A: Realtime voice + interactive assistant workflows
- Task B: Operational intelligence + platform tools workflows
- Task Y: Incident/automation + background agent workflows
- Task ALL: End-to-end integration baseline

## Current State Summary

| Platform | Current State | Primary Integration Points |
| --- | --- | --- |
| OpenAI | In production use | API Worker realtime token minting, dashboard realtime WS, cloudbot responses/embeddings, voice backend chat completions, orchestrator incident triage |
| Cloudflare | In production use | Workers runtime, D1, Durable Objects, Containers binding, Wrangler deploy/secrets, Cloudflare API proxy routes |
| Traceloop | Not yet integrated | No `traceloop` package/config found; current tracing is custom trace headers + Anyway tracing in cloudbot |

## OpenAI Implementation

### Task A: Realtime Voice Agent

Flow:

1. Dashboard/mobile requests short-lived realtime token from API Worker: `POST /api/v1/realtime/token`.
2. API Worker resolves API key (`BYOK` first, then `OPENAI_API_KEY`) and calls `POST https://api.openai.com/v1/realtime/client_secrets`.
3. Client opens WebSocket to `wss://api.openai.com/v1/realtime?model=<model>`.
4. Client sends `session.update`, streams PCM mic audio, receives audio/text deltas, and executes tool calls through backend proxy endpoints.

Implementation files:

- `opencto/opencto-api-worker/src/index.ts`
- `opencto/opencto-api-worker/src/providerKeys.ts`
- `opencto/opencto-dashboard/src/lib/realtime/openaiAdapter.ts`
- `opencto/opencto-dashboard/src/lib/realtime/shared.ts`
- `opencto/mobile-app/src/api/realtime.ts`
- `opencto/opencto-sdk-js/src/clients/realtime.ts`

Key controls:

- Workspace-aware rate limiting (`realtime_token` bucket)
- BYOK secret storage with AES-GCM and masked key hints
- Backend-issued ephemeral client secret; browser never stores long-lived OpenAI key

### Task B: Operational Intelligence Tools (Model/Usage)

OpenAI tool calls in assistant sessions are routed to backend proxy endpoints:

- `GET /api/v1/cto/openai/models`
- `GET /api/v1/cto/openai/usage?start=YYYY-MM-DD&end=YYYY-MM-DD`

Implementation files:

- `opencto/opencto-api-worker/src/index.ts` (`proxyOpenAI`)
- `opencto/opencto-dashboard/src/lib/realtime/shared.ts` (`executeToolProxy`)
- `opencto/opencto-api-worker/docs/byok-rate-limits.md`

Key controls:

- Workspace-aware rate limit bucket `cto_openai_proxy`
- BYOK precedence over server fallback key
- Server-side key isolation (key never returned to client)

### Task Y: Background/Automation Workflows

OpenAI is used in autonomous back-end tasks:

- Incident triage and structured action generation via Responses API in orchestrator
- Multi-channel cloudbot response generation + embeddings for memory/RAG
- Voice backend chat completion endpoint (`/v1/respond`)

Implementation files:

- `opencto/cto-orchestrator/src/openai.js`
- `opencto/cto-orchestrator/src/config.js`
- `opencto/opencto-cloudbot-worker/src/index.ts`
- `opencto/opencto-voice-backend/app.py`

## Cloudflare Implementation

### Task A: Core Edge API + Identity/Billing

OpenCTO API is implemented as a Cloudflare Worker with D1 and auth/billing/compliance routes.

Implementation files:

- `opencto/opencto-api-worker/wrangler.toml`
- `opencto/opencto-api-worker/src/index.ts`
- `opencto/opencto-api-worker/src/types.ts`

Key runtime components:

- Workers runtime
- D1 (`DB` binding)
- Durable Object binding for container execution (`CODEBASE_EXECUTOR`)
- Production route: `api.opencto.works/*`

### Task B: Code Execution Plane (Containers)

API Worker supports a containerized code execution mode via Cloudflare Containers:

- `CODEBASE_EXECUTION_MODE=stub|container`
- Container runtime in `container-runtime/codebase-executor/`

Implementation files:

- `opencto/opencto-api-worker/docs/cloudflare-containers-mvp.md`
- `opencto/opencto-api-worker/container-runtime/codebase-executor/Dockerfile`
- `opencto/opencto-api-worker/container-runtime/codebase-executor/server.js`

### Task Y: Platform Operations Proxies

Cloudflare account operational data is exposed to assistant tools through API Worker proxy routes:

- `GET /api/v1/cto/cloudflare/workers`
- `GET /api/v1/cto/cloudflare/pages`
- `GET /api/v1/cto/cloudflare/workers/:name/usage`

Implementation files:

- `opencto/opencto-api-worker/src/index.ts` (`proxyCF`)
- `opencto/opencto-dashboard/src/lib/realtime/shared.ts` (`list_cloudflare_*` tools)

Key controls:

- `CF_API_TOKEN` + `CF_ACCOUNT_ID` required
- Rate limited via `cto_proxy` bucket
- Backend token shielding from client

## Traceloop Implementation Plan

### Current State

- No direct Traceloop package/config integration found in OpenCTO application surfaces.
- Existing telemetry patterns:
  - Custom trace headers in legacy SDK (`opencto/opencto-sdk/src/tracing.ts`)
  - Anyway tracing in cloudbot worker (`OPENCTO_ANYWAY_*`)

### Task A (Traceloop): Realtime Session Traces

Implement first for highest-value user path:

1. Add Traceloop/OpenTelemetry SDK in API Worker-adjacent services (or compatible edge-side collector pattern).
2. Emit spans for:
   - realtime token mint (`/api/v1/realtime/token`)
   - open websocket session lifecycle events
   - tool execution latency and error rate
3. Propagate trace IDs from backend to dashboard for session correlation.

### Task B (Traceloop): Backend Proxy + LLM Calls

Instrument:

- `proxyOpenAI` requests (latency, model, status)
- Cloudflare proxy endpoints (request class, status)
- BYOK resolution outcomes (without secrets)

Recommended attributes:

- `workspace.id`
- `route.name`
- `llm.vendor`
- `llm.model`
- `http.status_code`
- `error.type`

### Task Y (Traceloop): Orchestrator and CloudBot

Instrument background automation loops:

- incident polling cycle
- OpenAI triage call
- GitHub issue action execution
- cloudbot RAG retrieval + response generation

### Task ALL (Traceloop): Rollout Sequence

1. Design trace schema (span names, required attributes, redaction policy).
2. Instrument API Worker OpenAI + Cloudflare proxy paths.
3. Instrument orchestrator and cloudbot workflows.
4. Add dashboards/SLOs for:
   - token mint success rate
   - model call latency p95
   - tool call failure rate
   - incident triage loop completion latency
5. Add CI checks to prevent sensitive fields in traces.

## Environment Variable Matrix

| Area | Variables |
| --- | --- |
| OpenAI (API Worker) | `OPENAI_API_KEY`, `RATE_LIMIT_REALTIME_PER_MINUTE`, `RATE_LIMIT_CTO_OPENAI_PER_MINUTE` |
| OpenAI (Voice backend) | `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` |
| OpenAI (Orchestrator) | `OPENAI_API_KEY`, `OPENCTO_OPENAI_MODEL`, `OPENCTO_AGENT_MODEL` |
| Cloudflare API proxy | `CF_API_TOKEN`, `CF_ACCOUNT_ID` |
| Cloudflare worker ops | `wrangler.toml` bindings, D1/DO/Container bindings |
| Existing tracing (cloudbot) | `OPENCTO_ANYWAY_ENABLED`, `OPENCTO_ANYWAY_ENDPOINT`, `OPENCTO_ANYWAY_API_KEY` |

## Chicago 17B References

Cloudflare. “Overview.” *Cloudflare Workers Docs*. Accessed March 6, 2026. https://developers.cloudflare.com/workers/.

Cloudflare. “Overview.” *Cloudflare D1 Docs*. Accessed March 6, 2026. https://developers.cloudflare.com/d1/.

Cloudflare. “Overview.” *Cloudflare Durable Objects Docs*. Accessed March 6, 2026. https://developers.cloudflare.com/durable-objects/.

OpenAI. “Realtime API.” *OpenAI API Documentation*. Accessed March 6, 2026. https://developers.openai.com/api/docs/guides/realtime.

OpenAI. “Text Generation.” *OpenAI API Documentation*. Accessed March 6, 2026. https://developers.openai.com/api/docs/guides/text.

Traceloop. “Introduction.” *Traceloop Documentation*. Accessed March 6, 2026. https://www.traceloop.com/docs.
