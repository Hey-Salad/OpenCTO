# OpenCTO System Monitor UI

Minimal local web UI for machine metrics:
- uptime
- CPU load
- memory usage
- disk usage
- top CPU processes
- orchestrator status (dry-run/live, incidents, GitHub target, Telegram readiness)

## Run

```bash
cd opencto/system-monitor-ui
python3 server.py
```

Open:
- `http://127.0.0.1:8099`

Optional env:
- `OPENCTO_MONITOR_HOST` (default `127.0.0.1`)
- `OPENCTO_MONITOR_PORT` (default `8099`)
- `OPENCTO_ORCHESTRATOR_STATUS_PATH` (default points to `opencto/cto-orchestrator/.data/orchestrator-status.json`)

## Can this work with OpenAI CLI + SDK?

Yes. Recommended next step:
1. Keep this dashboard as telemetry source (`/api/metrics`).
2. Add an AI summarizer endpoint that sends metrics snapshots to OpenAI SDK.
3. Use Codex CLI/OpenAI CLI for runbooks: anomaly triage, suggested remediation, and incident notes.
