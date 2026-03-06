# Traceloop Implementation Guide

Version: v1.0  
Date: March 6, 2026  
Scope: OpenCTO Traceloop strategy and rollout

## Purpose

This guide defines how to implement Traceloop in OpenCTO. As of this date, there is no direct Traceloop integration in the repository.

## Current State

- No `traceloop` package/config usage found in OpenCTO product surfaces.
- Existing telemetry patterns are:
  - custom trace context headers in legacy SDK paths
  - Anyway tracing in cloudbot worker

This means Traceloop should be introduced as a new telemetry layer, not as an in-place replacement.

## Rollout Goals

1. End-to-end request tracing for realtime and agent workflows.
2. LLM span observability (latency, error, model usage metadata).
3. Correlation across API worker, orchestrator, cloudbot, and client-facing sessions.
4. Safe telemetry posture (no secrets/PII leakage).

## Recommended Rollout Phases

### Phase 1: API Worker Core

Instrument:

- `POST /api/v1/realtime/token`
- `GET /api/v1/cto/openai/models`
- `GET /api/v1/cto/openai/usage`
- `GET /api/v1/cto/cloudflare/*`

Required attributes:

- `workspace.id`
- `route.name`
- `llm.vendor`
- `llm.model` (when applicable)
- `http.status_code`
- `error.type`

### Phase 2: Agent Backends

Instrument:

- `opencto/cto-orchestrator` incident cycles and OpenAI triage calls
- `opencto/opencto-cloudbot-worker` RAG retrieval + response generation + webhook lifecycle

### Phase 3: Client Correlation

- propagate trace context IDs from API worker into dashboard/mobile session state
- attach trace IDs to support/debug payloads (without exposing secrets)

### Phase 4: Governance

- add CI checks for telemetry redaction rules
- enforce denylist for sensitive fields:
  - `token`, `secret`, `authorization`, API keys, raw credentials

## Suggested Environment Variables

| Variable | Purpose |
| --- | --- |
| `TRACELOOP_API_KEY` | Auth for Traceloop ingestion |
| `TRACELOOP_BASE_URL` | Optional endpoint override |
| `TRACELOOP_ENABLED` | Feature flag for gradual rollout |
| `TRACELOOP_SERVICE_NAME` | Service-level identity per component |
| `TRACELOOP_ENV` | Environment tag (`dev`, `staging`, `production`) |

## Suggested Service Matrix

| Service | Start Phase | Priority |
| --- | --- | --- |
| `opencto-api-worker` | Phase 1 | Critical |
| `cto-orchestrator` | Phase 2 | High |
| `opencto-cloudbot-worker` | Phase 2 | High |
| `opencto-voice-backend` | Phase 2/3 | Medium |
| dashboard/mobile clients | Phase 3 | Medium |

## Minimal Implementation Checklist

1. Add Traceloop SDK/config to `opencto-api-worker`.
2. Wrap OpenAI and Cloudflare proxy paths with spans.
3. Add span context propagation headers for cross-service correlation.
4. Add redaction middleware for trace attributes.
5. Repeat for orchestrator and cloudbot.
6. Build latency/error dashboards per workflow.

## Validation Checklist

- Trace appears for every `/api/v1/realtime/token` request.
- OpenAI model and usage proxy calls produce linked spans.
- Failed upstream requests show structured error attributes.
- No secret-bearing fields appear in traces.
- End-to-end correlation from user action to backend spans is queryable.

## References (Chicago 17B)

Traceloop. “Introduction.” *Traceloop Documentation*. Accessed March 6, 2026. https://www.traceloop.com/docs.

OpenTelemetry. “What Is OpenTelemetry?” *OpenTelemetry Documentation*. Accessed March 6, 2026. https://opentelemetry.io/docs/what-is-opentelemetry/.
