from __future__ import annotations

import argparse
import json
import shutil
import time
from pathlib import Path
from typing import Dict

from . import adb
from .engine import queue_files, read_task, run_task
from .openai_team import OpenAIError, create_task_with_team, write_task_file


def load_approvals(path: Path | None) -> Dict[str, bool]:
    if not path or not path.exists():
        return {}
    raw = json.loads(path.read_text())
    return {str(k): bool(v) for k, v in raw.items()}


def cmd_health(args: argparse.Namespace) -> int:
    try:
        res = adb.detect(serial=args.serial)
        print(json.dumps({"ok": True, "device": res}, indent=2))
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2))
        return 1


def cmd_run(args: argparse.Namespace) -> int:
    queue_dir = Path(args.queue_dir)
    runs_dir = Path(args.runs_dir)
    approvals = load_approvals(Path(args.approvals) if args.approvals else None)

    queue_dir.mkdir(parents=True, exist_ok=True)
    runs_dir.mkdir(parents=True, exist_ok=True)

    print(f"[android-autodev] watching queue: {queue_dir}")
    while True:
        files = list(queue_files(queue_dir))
        if not files:
            if args.once:
                return 0
            time.sleep(args.poll_sec)
            continue

        for task_file in files:
            task = read_task(task_file)
            summary = run_task(
                task,
                run_root=runs_dir,
                approvals=approvals,
                serial=args.serial,
                dry_run=args.dry_run,
            )
            done_dir = queue_dir / "processed"
            done_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(str(task_file), str(done_dir / task_file.name))
            print(json.dumps(summary, indent=2))

        if args.once:
            return 0


def cmd_team_create(args: argparse.Namespace) -> int:
    queue_dir = Path(args.queue_dir)
    try:
        task = create_task_with_team(goal=args.goal, serial=args.serial)
        path = write_task_file(task, queue_dir=queue_dir, filename=args.filename)
        print(json.dumps({"ok": True, "queued_task": str(path), "task_id": task["task_id"]}, indent=2))
        return 0
    except OpenAIError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2))
        return 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="android-autodev")
    sub = p.add_subparsers(dest="cmd", required=True)

    h = sub.add_parser("health", help="check adb device health")
    h.add_argument("--serial", default="", help="device serial (optional)")
    h.set_defaults(func=cmd_health)

    r = sub.add_parser("run", help="run task queue")
    r.add_argument("--queue-dir", default="./tasks")
    r.add_argument("--runs-dir", default="./runs")
    r.add_argument("--serial", default="")
    r.add_argument("--approvals", default="./configs/approvals.json")
    r.add_argument("--poll-sec", type=int, default=3)
    r.add_argument("--once", action="store_true")
    r.add_argument("--dry-run", action="store_true")
    r.set_defaults(func=cmd_run)

    t = sub.add_parser("team-create", help="create a queued task using Planner+Operator agents via OpenAI API")
    t.add_argument("--goal", required=True, help="natural language objective")
    t.add_argument("--queue-dir", default="./tasks")
    t.add_argument("--filename", default="", help="optional output filename (e.g. task-123.json)")
    t.add_argument("--serial", default="", help="device serial hint for planning")
    t.set_defaults(func=cmd_team_create)

    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
