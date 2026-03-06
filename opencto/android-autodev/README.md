# Android Autodev (v1)

Autonomous Android developer runner for a single USB-connected device.

## What v1 does

- Polls a local task queue (`tasks/*.json`)
- Executes allowlisted ADB actions only
- Logs structured events to `runs/<task_id>/events.ndjson`
- Stores artifacts (screenshots, command outputs) per task run
- Supports dry-run mode for safe validation

## Safety model

- Deny-by-default actions
- Strict allowlist command wrappers
- Input validation for package/activity/coordinates/key events
- Explicit risk tier in step definitions (`R0`, `R1`, `R2`, `R3`)
- Optional approval token checks for higher-risk tiers

## Quick start

1. Create venv and install minimal deps (none required beyond Python 3.10+)
2. Run health check:

```bash
python3 -m android_autodev.main health
```

3. Run loop:

```bash
python3 -m android_autodev.main run --queue-dir ./tasks --runs-dir ./runs
```

4. Dry run:

```bash
python3 -m android_autodev.main run --queue-dir ./tasks --runs-dir ./runs --dry-run
```

## Task format

See `docs/TASK_SCHEMA.md` and `tasks/sample-task.json`.

## Systemd

See `systemd/` unit files and `docs/RUNBOOK.md`.

## Anyway tracing

`android-autodev` can emit run + step trace events to an OpenCTO/Anyway-compatible
endpoint without impacting task execution (fail-open on network errors).

Set in `.env`:

```bash
AUTODEV_ANYWAY_ENABLED=true
AUTODEV_ANYWAY_ENDPOINT=https://trace-dev-collector.anyway.sh/trace/event
# Optional if sidecar auth is enabled:
# AUTODEV_ANYWAY_TOKEN=...
```

Trace events are sent from:
- queue runner (`task.started`, `step.*`, `task.completed`)
- team-create flow (`team.planner.*`, `team.operator.*`, `team.task.generated`)
