from __future__ import annotations

import json
import shlex
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Optional

from .policy import (
    PolicyError,
    validate_activity,
    validate_keycode,
    validate_package,
    validate_text,
)

ADB_BIN = "adb"


class AdbError(Exception):
    pass


def _run(cmd: List[str], timeout_sec: int = 30) -> Dict[str, str]:
    start = time.time()
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_sec)
    duration = int((time.time() - start) * 1000)
    return {
        "cmd": " ".join(shlex.quote(x) for x in cmd),
        "stdout": proc.stdout.strip(),
        "stderr": proc.stderr.strip(),
        "returncode": str(proc.returncode),
        "duration_ms": str(duration),
    }


def _require_success(result: Dict[str, str]) -> None:
    if result["returncode"] != "0":
        raise AdbError(
            f"adb failed ({result['returncode']}): {result['stderr'] or result['stdout']}"
        )


def detect(serial: Optional[str] = None, timeout_sec: int = 15) -> Dict[str, object]:
    _require_success(_run([ADB_BIN, "start-server"], timeout_sec=timeout_sec))
    out = _run([ADB_BIN, "devices", "-l"], timeout_sec=timeout_sec)
    _require_success(out)

    devices = []
    lines = [ln.strip() for ln in out["stdout"].splitlines() if ln.strip()]
    for ln in lines[1:]:
        parts = ln.split()
        if len(parts) < 2:
            continue
        serial_id = parts[0]
        state = parts[1]
        extra = " ".join(parts[2:])
        devices.append({"serial": serial_id, "state": state, "extra": extra})

    if not devices:
        raise AdbError("no connected devices")

    if serial:
        filtered = [d for d in devices if d["serial"] == serial]
        if not filtered:
            raise AdbError(f"serial not found: {serial}")
        devices = filtered

    active = next((d for d in devices if d["state"] == "device"), None)
    if not active:
        raise AdbError("no authorized device in 'device' state")

    serial_id = active["serial"]
    boot = _run([ADB_BIN, "-s", serial_id, "shell", "getprop", "sys.boot_completed"], timeout_sec=timeout_sec)
    _require_success(boot)

    return {
        "serial": serial_id,
        "devices": devices,
        "boot_completed": boot["stdout"].strip() == "1",
    }


def launch(serial: str, package: str, activity: Optional[str], timeout_sec: int = 30) -> Dict[str, str]:
    validate_package(package)
    if activity:
        validate_activity(activity)
        res = _run([ADB_BIN, "-s", serial, "shell", "am", "start", "-W", "-n", f"{package}/{activity}"], timeout_sec=timeout_sec)
    else:
        res = _run([ADB_BIN, "-s", serial, "shell", "monkey", "-p", package, "-c", "android.intent.category.LAUNCHER", "1"], timeout_sec=timeout_sec)
    _require_success(res)
    return res


def tap(serial: str, x: int, y: int, timeout_sec: int = 15) -> Dict[str, str]:
    if x < 0 or y < 0:
        raise PolicyError("tap coordinates must be non-negative")
    res = _run([ADB_BIN, "-s", serial, "shell", "input", "tap", str(x), str(y)], timeout_sec=timeout_sec)
    _require_success(res)
    return res


def text(serial: str, value: str, timeout_sec: int = 15) -> Dict[str, str]:
    validate_text(value)
    encoded = value.replace(" ", "%s")
    res = _run([ADB_BIN, "-s", serial, "shell", "input", "text", encoded], timeout_sec=timeout_sec)
    _require_success(res)
    return res


def key(serial: str, keycode: str, timeout_sec: int = 15) -> Dict[str, str]:
    validate_keycode(keycode)
    res = _run([ADB_BIN, "-s", serial, "shell", "input", "keyevent", keycode], timeout_sec=timeout_sec)
    _require_success(res)
    return res


def screenshot(serial: str, output_path: Path, timeout_sec: int = 20) -> Dict[str, str]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    start = time.time()
    with output_path.open("wb") as f:
        proc = subprocess.run(
            [ADB_BIN, "-s", serial, "exec-out", "screencap", "-p"],
            stdout=f,
            stderr=subprocess.PIPE,
            timeout=timeout_sec,
        )
    duration = int((time.time() - start) * 1000)
    if proc.returncode != 0:
        raise AdbError(f"screenshot failed: {proc.stderr.decode(errors='replace').strip()}")
    if output_path.stat().st_size <= 16:
        raise AdbError("screenshot artifact empty")
    return {
        "cmd": f"{ADB_BIN} -s {serial} exec-out screencap -p > {output_path}",
        "stdout": "",
        "stderr": "",
        "returncode": "0",
        "duration_ms": str(duration),
        "artifact": str(output_path),
    }
