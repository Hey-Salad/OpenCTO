# OpenCTO CTO Orchestrator

Autonomous incident-triage and governance loop for OpenCTO.

It polls system metrics, generates model-backed triage, updates GitHub issues, and can optionally interact via Telegram.

## Capabilities

- Poll metrics from `OPENCTO_MONITOR_URL`
- Detect sustained resource pressure (CPU/memory/disk)
- Generate triage via OpenAI SDK
- Create/reuse GitHub incidents
- Send Telegram alerts and support bot-mode interactions
- Run autonomous governance cycles over roadmap/issues/PRs
- Emit telemetry to Traceloop and Anyway sidecar

## Prerequisites

- Node.js `>= 18`
- npm
- Valid `OPENAI_API_KEY`
- GitHub token with required repo scope for issue/PR operations

## Quick Start

### 1) Install

```bash
cd opencto/cto-orchestrator
npm install
```

### 2) Configure

```bash
cp .env.example .env
```

Minimum required for a useful local run:

```bash
OPENAI_API_KEY=...
GITHUB_TOKEN=...
OPENCTO_MONITOR_URL=http://127.0.0.1:8787/api/metrics
OPENCTO_DRY_RUN=true
```

### 3) Run

```bash
npm start
```

### 4) Test

```bash
npm test
```

## Operating Modes

- `OPENCTO_DRY_RUN=true`: safe mode, no external mutations
- `OPENCTO_DRY_RUN=false`: production mode, applies live actions

Keep dry-run enabled until repository target, labels, and alerting are verified.

## Telegram Mode (Optional)

Enable in `.env`:

```bash
OPENCTO_TELEGRAM_ENABLED=true
OPENCTO_TELEGRAM_BOT_TOKEN=123456:ABC...
OPENCTO_TELEGRAM_CHAT_IDS=123456789
OPENCTO_TELEGRAM_BOT_MODE=true
OPENCTO_TELEGRAM_POLL_SECONDS=3
OPENCTO_REQUIRE_APPROVALS=true
```

Approval flow for risky operations:

1. Bot returns an `approval_id`
2. Operator runs `/approve <approval_id>` or `/deny <approval_id>`

## Autonomous Governance Loop

Enable continuous roadmap/issues/PR cycle:

```bash
OPENCTO_AUTONOMY_ENABLED=true
OPENCTO_AUTONOMY_CYCLE_SECONDS=300
OPENCTO_AUTONOMY_ROADMAP_PATH=/home/hs-chilu/heysalad-ai-projects/CTO-AI/docs/opencto/IOS_APP_ROADMAP.md
OPENCTO_AUTONOMY_MAX_ISSUE_COMMENTS=3
OPENCTO_AUTONOMY_MAX_PR_REVIEWS=3
OPENCTO_AUTONOMY_AUTO_MERGE=false
OPENCTO_AUTONOMY_MERGE_LABEL=auto-merge
```

## Observability

### Traceloop / OpenLLMetry

```bash
OPENCTO_TRACE_ENABLED=true
OPENCTO_TRACE_SERVICE_NAME=opencto-cto-orchestrator
TRACELOOP_API_KEY=...
OTEL_EXPORTER_OTLP_ENDPOINT=https://...  # optional
```

### Anyway Sidecar Mirroring

```bash
OPENCTO_SIDECAR_ENABLED=true
OPENCTO_SIDECAR_URL=https://anyway-sdk-sidecar.opencto.works/trace/event
OPENCTO_SIDECAR_TOKEN=...
OPENCTO_AGENT_MODEL_PLANNER=gpt-5.4
OPENCTO_AGENT_MODEL_EXECUTOR=gpt-5.3-codex
OPENCTO_AGENT_MODEL_REVIEWER=gemini-2.5-pro
```

## Systemd User Service

```bash
cp deploy/opencto-cto-orchestrator.service ~/.config/systemd/user/opencto-cto-orchestrator.service
systemctl --user daemon-reload
systemctl --user enable --now opencto-cto-orchestrator.service
```

Logs:

```bash
journalctl --user -u opencto-cto-orchestrator.service --no-pager -n 100
```

## Security Notes

- Never commit `.env`.
- Use least-privilege GitHub tokens.
- Keep approvals enabled unless full autonomy is explicitly intended.
- Model outputs are validated and actions are allow-listed, but still treat runtime mutations as privileged operations.

## How-To Guides

### How to run a safe local triage loop

1. Copy `.env.example` to `.env`.
2. Set `OPENAI_API_KEY`, `GITHUB_TOKEN`, and `OPENCTO_MONITOR_URL`.
3. Keep `OPENCTO_DRY_RUN=true`.
4. Run `npm start`.
5. Validate logs show polling + triage output without writing live mutations.

### How to enable Telegram approvals

1. Set `OPENCTO_TELEGRAM_ENABLED=true` and bot credentials.
2. Set `OPENCTO_REQUIRE_APPROVALS=true`.
3. Send a risky command and confirm bot returns `approval_id`.
4. Use `/approve <approval_id>` and confirm controlled action execution.

### How to run continuously on one machine

1. Install systemd user service file from `deploy/`.
2. Run `systemctl --user daemon-reload`.
3. Run `systemctl --user enable --now opencto-cto-orchestrator.service`.
4. Monitor logs with `journalctl --user -u opencto-cto-orchestrator.service -n 100`.

## References (Chicago 17th, Bibliography)

GitHub. n.d. "REST API Documentation." Accessed March 6, 2026. https://docs.github.com/en/rest.

OpenAI. n.d. "Responses API." OpenAI Platform Docs. Accessed March 6, 2026. https://platform.openai.com/docs/api-reference/responses.

Telegram. n.d. "Bot API." Accessed March 6, 2026. https://core.telegram.org/bots/api.

Traceloop. n.d. "Traceloop Documentation." Accessed March 6, 2026. https://docs.traceloop.com/.
