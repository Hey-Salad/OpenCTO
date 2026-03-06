# OpenAI Implementation Guide

Version: v1.0  
Date: March 6, 2026  
Scope: OpenCTO OpenAI integrations only

## Purpose

This guide documents how OpenCTO currently uses OpenAI across product surfaces and background services.

## Where OpenAI Is Used

1. Realtime voice assistant sessions (dashboard + mobile via API Worker token minting).
2. OpenAI operational proxy endpoints (`models`, `usage`) for tool-driven platform observability.
3. Incident/autonomy workflows in orchestrator.
4. Multi-channel cloudbot responses and embeddings.
5. Voice backend chat completion endpoint.

## Architecture

```text
Client (Dashboard/Mobile/SDK)
        |
        v
OpenCTO API Worker
- POST /api/v1/realtime/token
- GET /api/v1/cto/openai/models
- GET /api/v1/cto/openai/usage
        |
        v
OpenAI API
```

## Core Implementation Points

### Realtime Token Minting

- Endpoint: `POST /api/v1/realtime/token`
- File: `opencto/opencto-api-worker/src/index.ts`
- Behavior:
  - resolves key by workspace/user via BYOK (`provider=openai`) or `OPENAI_API_KEY` fallback
  - calls `https://api.openai.com/v1/realtime/client_secrets`
  - returns ephemeral `clientSecret` to browser/mobile

### Realtime Session Client

- Files:
  - `opencto/opencto-dashboard/src/lib/realtime/openaiAdapter.ts`
  - `opencto/mobile-app/src/api/realtime.ts`
- Behavior:
  - connects to `wss://api.openai.com/v1/realtime?model=<model>`
  - uses subprotocol auth: `openai-insecure-api-key.<clientSecret>`
  - streams PCM audio, receives transcript/audio deltas
  - executes function tools via backend proxy routes

### OpenAI Proxy Endpoints

- Routes:
  - `GET /api/v1/cto/openai/models`
  - `GET /api/v1/cto/openai/usage?start=<date>&end=<date>`
- File: `opencto/opencto-api-worker/src/index.ts` (`proxyOpenAI`)
- Used by dashboard tool execution in `opencto/opencto-dashboard/src/lib/realtime/shared.ts`

### BYOK Key Management

- File: `opencto/opencto-api-worker/src/providerKeys.ts`
- Routes:
  - `GET /api/v1/llm/keys`
  - `PUT /api/v1/llm/keys/openai`
  - `DELETE /api/v1/llm/keys/openai`
- Security:
  - AES-GCM at-rest encryption
  - per user + workspace + provider key scope
  - only masked hints are returned

## Environment Variables

| Area | Variables |
| --- | --- |
| API Worker | `OPENAI_API_KEY`, `RATE_LIMIT_REALTIME_PER_MINUTE`, `RATE_LIMIT_CTO_OPENAI_PER_MINUTE` |
| Voice backend | `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` |
| Orchestrator | `OPENAI_API_KEY`, `OPENCTO_OPENAI_MODEL`, `OPENCTO_AGENT_MODEL` |
| Cloudbot worker | `OPENAI_API_KEY`, `OPENCTO_AGENT_MODEL`, `OPENCTO_EMBED_MODEL` |

## Operational Runbook

1. Set `OPENAI_API_KEY` in API Worker (`wrangler secret put OPENAI_API_KEY`).
2. For multi-tenant setups, save per-workspace key via `PUT /api/v1/llm/keys/openai`.
3. Validate realtime path:
   - call `/api/v1/realtime/token`
   - confirm non-empty `clientSecret`
4. Validate ops path:
   - call `/api/v1/cto/openai/models`
   - call `/api/v1/cto/openai/usage`
5. Monitor 429 and 5xx rates on:
   - `realtime_token`
   - `cto_openai_proxy`

## References (Chicago 17B)

OpenAI. “Realtime API.” *OpenAI API Documentation*. Accessed March 6, 2026. https://developers.openai.com/api/docs/guides/realtime.

OpenAI. “Text Generation.” *OpenAI API Documentation*. Accessed March 6, 2026. https://developers.openai.com/api/docs/guides/text.
