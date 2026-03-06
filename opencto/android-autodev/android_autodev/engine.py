from __future__ import annotations

import json
import time
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from . import adb
from .anyway_trace import AnywayTracer
from .policy import PolicyError, validate_action, validate_risk
from .types import Step, StepResult, Task


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_task(path: Path) -> Task:
    raw = json.loads(path.read_text())
    steps = [Step(**step) for step in raw["steps"]]
    return Task(
        task_id=raw["task_id"],
        goal=raw["goal"],
        steps=steps,
        created_at=raw.get("created_at", now_iso()),
        status=raw.get("status", "queued"),
        metadata=raw.get("metadata", {}),
    )


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def append_event(path: Path, event: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, sort_keys=True) + "\n")


def execute_step(step: Step, serial: str, run_dir: Path, dry_run: bool) -> StepResult:
    start = time.time()
    try:
        if dry_run:
            return StepResult(ok=True, output={"dry_run": True}, duration_ms=int((time.time() - start) * 1000))

        if step.action == "android.detect":
            out = adb.detect(serial=serial or None, timeout_sec=step.timeout_sec)
        elif step.action == "android.launch":
            out = adb.launch(serial=serial, package=step.args["package"], activity=step.args.get("activity"), timeout_sec=step.timeout_sec)
        elif step.action == "android.tap":
            out = adb.tap(serial=serial, x=int(step.args["x"]), y=int(step.args["y"]), timeout_sec=step.timeout_sec)
        elif step.action == "android.text":
            out = adb.text(serial=serial, value=str(step.args["text"]), timeout_sec=step.timeout_sec)
        elif step.action == "android.key":
            out = adb.key(serial=serial, keycode=str(step.args["keycode"]), timeout_sec=step.timeout_sec)
        elif step.action == "android.screenshot":
            artifact = run_dir / "evidence" / f"{step.step_id}.png"
            out = adb.screenshot(serial=serial, output_path=artifact, timeout_sec=step.timeout_sec)
        else:
            raise PolicyError(f"unsupported action: {step.action}")

        return StepResult(ok=True, output=out, duration_ms=int((time.time() - start) * 1000))
    except Exception as exc:
        return StepResult(ok=False, error=str(exc), duration_ms=int((time.time() - start) * 1000))


def run_task(task: Task, run_root: Path, approvals: Dict[str, bool], serial: str, dry_run: bool) -> Dict[str, Any]:
    run_id = f"{task.task_id}--{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')}"
    trace_id = uuid.uuid4().hex
    run_dir = run_root / run_id
    events_file = run_dir / "events.ndjson"
    tracer = AnywayTracer.from_env(scope=f"task:{task.task_id}:{run_id}", trace_id=trace_id)
    write_json(run_dir / "task.json", asdict(task))

    append_event(events_file, {"ts": now_iso(), "type": "task.started", "task_id": task.task_id, "run_id": run_id, "trace_id": trace_id, "goal": task.goal})
    tracer.emit(
        "task.started",
        text=f"task.started {task.task_id}",
        attributes={"task_id": task.task_id, "run_id": run_id, "goal": task.goal, "dry_run": dry_run},
    )

    step_results: List[Dict[str, Any]] = []
    current_serial = serial

    for step in task.steps:
        step_dict = asdict(step)
        append_event(events_file, {"ts": now_iso(), "type": "step.started", "task_id": task.task_id, "run_id": run_id, "trace_id": trace_id, "step_id": step.step_id, "action": step.action})
        tracer.emit(
            "step.started",
            text=f"step.started {step.step_id} ({step.action})",
            attributes={
                "task_id": task.task_id,
                "run_id": run_id,
                "step_id": step.step_id,
                "action": step.action,
                "risk_tier": step.risk_tier,
            },
        )
        try:
            validate_action(step.action)
            validate_risk(step_dict, approvals)
        except Exception as exc:
            result = StepResult(ok=False, error=f"policy blocked: {exc}")
            step_results.append({"step": step_dict, "result": asdict(result)})
            append_event(events_file, {"ts": now_iso(), "type": "step.blocked", "task_id": task.task_id, "run_id": run_id, "trace_id": trace_id, "step_id": step.step_id, "error": result.error})
            tracer.emit(
                "step.blocked",
                text=f"step.blocked {step.step_id}",
                attributes={"task_id": task.task_id, "run_id": run_id, "step_id": step.step_id, "error": result.error},
            )
            break

        attempts = max(1, step.retries + 1)
        last_result: Optional[StepResult] = None
        for attempt in range(1, attempts + 1):
            result = execute_step(step, serial=current_serial, run_dir=run_dir, dry_run=dry_run)
            last_result = result
            append_event(
                events_file,
                {
                    "ts": now_iso(),
                    "type": "step.attempt",
                    "task_id": task.task_id,
                    "run_id": run_id,
                    "trace_id": trace_id,
                    "step_id": step.step_id,
                    "attempt": attempt,
                    "ok": result.ok,
                    "error": result.error,
                    "duration_ms": result.duration_ms,
                },
            )
            tracer.emit(
                "step.attempt",
                text=f"step.attempt {step.step_id}#{attempt} {'ok' if result.ok else 'fail'}",
                attributes={
                    "task_id": task.task_id,
                    "run_id": run_id,
                    "step_id": step.step_id,
                    "attempt": attempt,
                    "ok": result.ok,
                    "error": result.error,
                    "duration_ms": result.duration_ms,
                },
            )
            if result.ok:
                if step.action == "android.detect":
                    detected_serial = str(result.output.get("serial", "")).strip()
                    if detected_serial:
                        current_serial = detected_serial
                break
            if attempt < attempts:
                time.sleep(min(2 ** (attempt - 1), 8))

        if last_result is None:
            last_result = StepResult(ok=False, error="step produced no result")

        step_results.append({"step": step_dict, "result": asdict(last_result)})
        if not last_result.ok:
            append_event(events_file, {"ts": now_iso(), "type": "step.failed", "task_id": task.task_id, "run_id": run_id, "trace_id": trace_id, "step_id": step.step_id, "error": last_result.error})
            tracer.emit(
                "step.failed",
                text=f"step.failed {step.step_id}",
                attributes={"task_id": task.task_id, "run_id": run_id, "step_id": step.step_id, "error": last_result.error},
            )
            break

    ok = all(item["result"]["ok"] for item in step_results) and len(step_results) == len(task.steps)
    summary = {
        "task_id": task.task_id,
        "run_id": run_id,
        "trace_id": trace_id,
        "run_dir": str(run_dir),
        "ok": ok,
        "steps_total": len(task.steps),
        "steps_executed": len(step_results),
        "failed_steps": [x["step"]["step_id"] for x in step_results if not x["result"]["ok"]],
        "dry_run": dry_run,
        "finished_at": now_iso(),
    }

    write_json(run_dir / "summary.json", summary)
    write_json(run_dir / "steps.json", {"steps": step_results})
    append_event(events_file, {"ts": now_iso(), "type": "task.completed", "task_id": task.task_id, "run_id": run_id, "trace_id": trace_id, "ok": ok})
    tracer.emit(
        "task.completed",
        text=f"task.completed {task.task_id} {'ok' if ok else 'fail'}",
        attributes={
            "task_id": task.task_id,
            "run_id": run_id,
            "ok": ok,
            "steps_total": len(task.steps),
            "steps_executed": len(step_results),
            "failed_steps": summary["failed_steps"],
            "dry_run": dry_run,
        },
    )
    return summary


def queue_files(queue_dir: Path) -> Iterable[Path]:
    return sorted(queue_dir.glob("*.json"))
