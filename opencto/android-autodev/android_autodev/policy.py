from __future__ import annotations

import re
from typing import Dict, Set


ALLOWED_ACTIONS: Set[str] = {
    "android.detect",
    "android.launch",
    "android.tap",
    "android.text",
    "android.key",
    "android.screenshot",
}

ALLOWED_KEYCODES: Set[str] = {
    "KEYCODE_HOME",
    "KEYCODE_BACK",
    "KEYCODE_ENTER",
    "KEYCODE_DEL",
    "KEYCODE_APP_SWITCH",
}

PACKAGE_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$")
ACTIVITY_RE = re.compile(r"^[A-Za-z0-9_.$/]+$")


class PolicyError(Exception):
    pass


def validate_action(action: str) -> None:
    if action not in ALLOWED_ACTIONS:
        raise PolicyError(f"action not allowed: {action}")


def validate_package(package: str) -> None:
    if not PACKAGE_RE.match(package):
        raise PolicyError(f"invalid package: {package}")


def validate_activity(activity: str) -> None:
    if not ACTIVITY_RE.match(activity):
        raise PolicyError(f"invalid activity: {activity}")


def validate_text(text: str) -> None:
    if len(text) > 500:
        raise PolicyError("text too long")
    for ch in [";", "&", "|", "`", "$", "<", ">"]:
        if ch in text:
            raise PolicyError("text contains disallowed shell character")


def validate_keycode(keycode: str) -> None:
    if keycode not in ALLOWED_KEYCODES:
        raise PolicyError(f"keycode not allowed: {keycode}")


def validate_risk(step: Dict[str, str], approvals: Dict[str, bool]) -> None:
    tier = step.get("risk_tier", "R0")
    if tier in {"R2", "R3"}:
        token = step.get("approval_token", "")
        if not token or not approvals.get(token, False):
            raise PolicyError(f"missing valid approval token for {tier}")
