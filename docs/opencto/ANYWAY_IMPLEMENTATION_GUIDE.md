# Anyway Implementation Guide

Version: v1.0  
Date: March 6, 2026  
Scope: OpenCTO Anyway tracing integration only

## Purpose

This guide documents the current Anyway integration in OpenCTO and how to operate it safely.

## Current State

Anyway tracing is implemented in the cloudbot worker only.

- Worker: `opencto/opencto-cloudbot-worker`
- Core file: `opencto/opencto-cloudbot-worker/src/index.ts`
- Pattern: fail-open trace buffer that never blocks user responses

No Anyway integration is currently wired into:

- `opencto/opencto-api-worker`
- `opencto/opencto-dashboard`
- `opencto/mobile-app`
- `opencto/cto-orchestrator`

## Architecture

```text
Webhook Event (Telegram/Slack/Infobip)
              |
              v
    OpenCTO CloudBot Worker
    - span buffer per request
    - flush at request completion
              |
              v
      Anyway ingest endpoint
```

## Implementation Details

### Enablement Gate

Tracing is enabled only when both are true:

1. `OPENCTO_ANYWAY_ENABLED=true`
2. `OPENCTO_ANYWAY_API_KEY` is configured

Code location:

- `anywayEnabled(env)` in `opencto/opencto-cloudbot-worker/src/index.ts`

### Trace Buffer

`AnywayTraceBuffer` handles:

- trace ID generation
- span start/end with status and attributes
- batched flush to ingest endpoint

Default ingest endpoint:

- `https://api.anyway.sh/v1/ingest`

Request payload shape:

- `{ traces: [{ trace_id, spans }], metrics: [] }`

### Instrumented Workflow Segments

Cloudbot spans are created around:

- Telegram webhook handling
- Slack webhook handling
- Infobip webhook handling
- lexical and semantic memory retrieval
- OpenAI response generation

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `OPENCTO_ANYWAY_ENABLED` | Global enable flag (`true`/`false`) |
| `OPENCTO_ANYWAY_API_KEY` | Bearer token for ingest auth |
| `OPENCTO_ANYWAY_ENDPOINT` | Optional custom ingest URL override |

## Deployment Runbook

1. Set secrets:

```bash
wrangler secret put OPENCTO_ANYWAY_API_KEY
```

2. Set vars in `wrangler.toml`:

```toml
OPENCTO_ANYWAY_ENABLED = "true"
OPENCTO_ANYWAY_ENDPOINT = "https://api.anyway.sh/v1/ingest"
```

3. Deploy worker:

```bash
wrangler deploy
```

4. Verify:
- `GET /health` confirms worker is up.
- Trigger a webhook event.
- Confirm traces arrive in Anyway.

## Operational Notes

- Integration is explicitly fail-open; telemetry failures are swallowed by design.
- Do not place user secrets in span attributes.
- Treat phone numbers and user IDs as sensitive identifiers; hash/redact where possible before adding new attributes.
