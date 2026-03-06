# Two-Agent Android Team

This project supports a two-agent task generation pipeline:

1. Planner agent (`OPENAI_MODEL_PLANNER`, default `gpt-5.4`)
2. Operator agent (`OPENAI_MODEL_OPERATOR`, default `codex`)

Both use `OPENAI_AUTODEV_API` via the OpenAI Responses API.
(`OPENAI_API_KEY` is still accepted as fallback for compatibility.)

## Command

```bash
python3 -m android_autodev.main team-create \
  --goal "Open the target app and capture a screenshot after login screen appears" \
  --queue-dir ./tasks
```

This writes a task JSON into `tasks/`. The running queue worker picks it up automatically.

## Environment

```bash
export OPENAI_AUTODEV_API=...
export OPENAI_MODEL_PLANNER=gpt-5.4
export OPENAI_MODEL_OPERATOR=codex
```

If your account uses different model IDs, set those env vars accordingly.

## Safety

- Task output is validated against the local allowlist.
- Only supported actions are accepted.
- Risk tiers `R2/R3` require approval tokens.
