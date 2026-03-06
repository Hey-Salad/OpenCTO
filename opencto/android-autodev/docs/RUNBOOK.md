# Runbook

## Start manually

```bash
cd /home/hs-chilu/heysalad-ai-projects/mobile-apps/android-autodev
python3 -m android_autodev.main health
python3 -m android_autodev.main run --queue-dir ./tasks --runs-dir ./runs
```

## Dry run

```bash
python3 -m android_autodev.main run --queue-dir ./tasks --runs-dir ./runs --dry-run --once
```

## Add a task

Drop a `*.json` task file into `tasks/`.
Processed files move to `tasks/processed/`.

## Inspect results

- `runs/<task_id>/summary.json`
- `runs/<task_id>/events.ndjson`
- `runs/<task_id>/steps.json`
- `runs/<task_id>/evidence/*.png`

## Trace endpoint setup (Anyway/OpenCTO)

Set tracing env vars before running:

```bash
export AUTODEV_ANYWAY_ENABLED=true
export AUTODEV_ANYWAY_ENDPOINT="https://trace-dev-collector.anyway.sh/trace/event"
# Optional (if your sidecar requires token auth):
# export AUTODEV_ANYWAY_TOKEN="..."
```

Quick test:

```bash
python3 -m android_autodev.main run --queue-dir ./tasks --runs-dir ./runs --dry-run --once
```

Then confirm:
- local artifacts contain `trace_id` in `summary.json` and `events.ndjson`
- trace events appear in your Anyway/OpenCTO dashboard

## Basic troubleshooting

```bash
adb devices -l
python3 -m android_autodev.main health
```

If unauthorized:
- Re-plug USB
- Accept USB debugging prompt on device
- Re-run health
