# OpenCTO CTO Orchestrator

Autonomous incident triage loop for OpenCTO.

It polls the local system monitor API, detects sustained risk signals, asks OpenAI for triage,
and updates GitHub issues in your target repository.

## What it does

- Reads metrics from `OPENCTO_MONITOR_URL`
- Detects high CPU / memory / disk pressure
- Produces structured triage using OpenAI SDK
- Creates or reuses incident issues in GitHub
- Sends Telegram alerts (optional)
- Supports Telegram natural-language bot mode with safe tool calling
- Posts periodic incident updates with cooldown and comment caps
- Persists local state for dedupe and restart safety
- Writes a machine-readable status file for dashboards

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
# edit .env and set OPENAI_API_KEY + GITHUB_TOKEN
```

3. Dry-run locally:

```bash
npm start
```

4. Run tests:

```bash
npm test
```

## Production mode

Set in `.env`:

```bash
OPENCTO_DRY_RUN=false
```

## Telegram setup (optional)

Set in `.env`:

```bash
OPENCTO_TELEGRAM_ENABLED=true
OPENCTO_TELEGRAM_BOT_TOKEN=123456:ABC...
OPENCTO_TELEGRAM_CHAT_IDS=123456789
OPENCTO_TELEGRAM_BOT_MODE=true
OPENCTO_TELEGRAM_POLL_SECONDS=3
OPENCTO_AGENT_MODEL=gpt-4.1-mini
```

If you need your numeric chat ID, message your bot first and then call:

```bash
curl "https://api.telegram.org/bot<token>/getUpdates"
```

### Telegram bot behavior

- Natural language chat is enabled for configured chat IDs.
- The bot auto-routes each request to relevant installed playbooks (always includes CTO baseline).
- Read-only safe tools are auto-executed: machine metrics, service status, service logs, pending approvals.
- Risky operation (`restart_service`) is approval-gated:
  - bot queues approval and returns an `approval_id`
  - user must run `/approve <approval_id>` or `/deny <approval_id>`

Default is approval-gated (`OPENCTO_REQUIRE_APPROVALS=true`).
Set `OPENCTO_REQUIRE_APPROVALS=false` only if you explicitly want full-autonomous execution mode.

## Autonomous governance loop

The orchestrator can run a continuous GitHub governance cycle:

- reads roadmap sections and ensures tracking issues exist
- posts autonomous issue discussion updates
- reviews open PRs with model-backed summaries
- auto-merges approved PRs that carry the configured merge label and have green checks

Key env vars:

```bash
OPENCTO_AUTONOMY_ENABLED=true
OPENCTO_AUTONOMY_CYCLE_SECONDS=300
OPENCTO_AUTONOMY_ROADMAP_PATH=/home/hs-chilu/heysalad-ai-projects/CTO-AI/docs/opencto/IOS_APP_ROADMAP.md
OPENCTO_AUTONOMY_MAX_ISSUE_COMMENTS=3
OPENCTO_AUTONOMY_MAX_PR_REVIEWS=3
OPENCTO_AUTONOMY_AUTO_MERGE=false
OPENCTO_AUTONOMY_MERGE_LABEL=auto-merge
```

## Systemd (user service)

Install the unit:

```bash
cp deploy/opencto-cto-orchestrator.service ~/.config/systemd/user/opencto-cto-orchestrator.service
systemctl --user daemon-reload
systemctl --user enable --now opencto-cto-orchestrator.service
```

Logs:

```bash
journalctl --user -u opencto-cto-orchestrator.service --no-pager -n 100
```

## Security notes

- Keep `.env` out of git.
- Use least-privilege `GITHUB_TOKEN` with issue read/write scope only.
- Keep `OPENCTO_DRY_RUN=true` until you verify repository targets and labels.
- The model output is validated and action types are allow-listed.
