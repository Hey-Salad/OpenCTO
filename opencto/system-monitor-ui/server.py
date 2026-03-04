#!/usr/bin/env python3
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
START_TIME = time.time()
ORCHESTRATOR_STATUS_PATH = Path(
    os.environ.get(
        "OPENCTO_ORCHESTRATOR_STATUS_PATH",
        "/home/hs-chilu/heysalad-ai-projects/CTO-AI/opencto/cto-orchestrator/.data/orchestrator-status.json",
    )
)


def read_uptime_seconds() -> float:
    try:
        with open("/proc/uptime", "r", encoding="utf-8") as handle:
            return float(handle.read().split()[0])
    except Exception:
        return max(0.0, time.time() - START_TIME)


def top_processes() -> list[dict]:
    try:
        cmd = ["ps", "-eo", "pid,comm,%cpu,%mem", "--sort=-%cpu"]
        output = subprocess.check_output(cmd, text=True, timeout=2)
        lines = output.strip().splitlines()[1:7]
        rows = []
        for line in lines:
            parts = line.split(None, 3)
            if len(parts) != 4:
                continue
            rows.append(
                {
                    "pid": int(parts[0]),
                    "name": parts[1],
                    "cpu": float(parts[2]),
                    "mem": float(parts[3]),
                }
            )
        return rows
    except Exception:
        return []


def memory_info() -> dict:
    mem = {"total": 0, "available": 0}
    try:
        with open("/proc/meminfo", "r", encoding="utf-8") as handle:
            for line in handle:
                key, value = line.split(":", 1)
                if key == "MemTotal":
                    mem["total"] = int(value.strip().split()[0]) * 1024
                if key == "MemAvailable":
                    mem["available"] = int(value.strip().split()[0]) * 1024
        used = max(0, mem["total"] - mem["available"])
        pct = (used / mem["total"] * 100) if mem["total"] else 0
        return {"total_bytes": mem["total"], "used_bytes": used, "used_pct": round(pct, 2)}
    except Exception:
        return {"total_bytes": 0, "used_bytes": 0, "used_pct": 0}


def cpu_info() -> dict:
    loads = os.getloadavg() if hasattr(os, "getloadavg") else (0.0, 0.0, 0.0)
    cores = os.cpu_count() or 1
    return {
        "cores": cores,
        "load_1m": round(loads[0], 3),
        "load_5m": round(loads[1], 3),
        "load_15m": round(loads[2], 3),
        "load_pct_1m": round(min(100.0, (loads[0] / cores) * 100), 2),
    }


def disk_info() -> dict:
    usage = shutil.disk_usage("/")
    used = usage.used
    total = usage.total
    pct = (used / total * 100) if total else 0
    return {
        "mount": "/",
        "total_bytes": total,
        "used_bytes": used,
        "free_bytes": usage.free,
        "used_pct": round(pct, 2),
    }


def collect_metrics() -> dict:
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "host": {
            "hostname": socket.gethostname(),
            "platform": platform.platform(),
            "python": sys.version.split()[0],
            "kernel": platform.release(),
        },
        "uptime_seconds": round(read_uptime_seconds(), 2),
        "cpu": cpu_info(),
        "memory": memory_info(),
        "disk": disk_info(),
        "top_processes": top_processes(),
    }

def orchestrator_status() -> dict:
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "available": False,
        "dryRun": None,
        "githubTarget": "unknown",
        "lastCycle": "unknown",
        "incidentsTracked": 0,
        "pendingApprovals": 0,
        "telegram": {"enabled": False, "configured": False, "chatCount": 0},
        "error": None,
    }
    try:
        if not ORCHESTRATOR_STATUS_PATH.exists():
            payload["error"] = "status_file_missing"
            return payload

        data = json.loads(ORCHESTRATOR_STATUS_PATH.read_text(encoding="utf-8"))
        payload.update(
            {
                "timestamp": data.get("timestamp", payload["timestamp"]),
                "available": True,
                "dryRun": data.get("dryRun"),
                "githubTarget": data.get("githubTarget", "unknown"),
                "lastCycle": data.get("lastCycle", "unknown"),
                "incidentsTracked": int(data.get("incidentsTracked", 0) or 0),
                "pendingApprovals": int(data.get("pendingApprovals", 0) or 0),
                "incidents": data.get("incidents", []),
                "events": data.get("events", []),
                "telegram": data.get("telegram", payload["telegram"]),
                "error": data.get("error"),
            }
        )
        return payload
    except Exception as exc:
        payload["error"] = f"status_read_error: {exc}"
        return payload


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/metrics":
            payload = json.dumps(collect_metrics()).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if parsed.path == "/api/orchestrator":
            payload = json.dumps(orchestrator_status()).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()


def main() -> None:
    host = os.environ.get("OPENCTO_MONITOR_HOST", "127.0.0.1")
    port = int(os.environ.get("OPENCTO_MONITOR_PORT", "8099"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"OpenCTO system monitor running on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
