from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List
from urllib import request

from .anyway_trace import AnywayTracer
from .policy import ALLOWED_ACTIONS


class OpenAIError(Exception):
    pass


def _extract_json_object(text: str) -> Dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?", "", stripped).strip()
        stripped = re.sub(r"```$", "", stripped).strip()

    try:
        return json.loads(stripped)
    except Exception:
        pass

    match = re.search(r"\{.*\}", stripped, flags=re.S)
    if not match:
        raise OpenAIError("model output did not contain JSON object")
    return json.loads(match.group(0))


def _response_text(payload: Dict[str, Any]) -> str:
    if isinstance(payload.get("output_text"), str) and payload["output_text"].strip():
        return payload["output_text"]

    parts: List[str] = []
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            ctype = content.get("type")
            if ctype in {"output_text", "text"} and isinstance(content.get("text"), str):
                parts.append(content["text"])
    text = "\n".join(parts).strip()
    if not text:
        raise OpenAIError("no text content in OpenAI response")
    return text


def _call_openai(model: str, prompt: str) -> str:
    api_key = os.getenv("OPENAI_AUTODEV_API", "").strip() or os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise OpenAIError("OPENAI_AUTODEV_API is not set (fallback OPENAI_API_KEY also missing)")

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    url = f"{base_url}/responses"
    body = {
        "model": model,
        "input": prompt,
        "temperature": 0.2,
    }

    req = request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
    except Exception as exc:
        raise OpenAIError(f"OpenAI API request failed: {exc}") from exc

    try:
        payload = json.loads(raw)
    except Exception as exc:
        raise OpenAIError(f"OpenAI API returned invalid JSON: {exc}") from exc

    return _response_text(payload)


def _validate_task(task: Dict[str, Any]) -> None:
    required = ["task_id", "goal", "created_at", "steps"]
    for key in required:
        if key not in task:
            raise OpenAIError(f"generated task missing required field: {key}")

    steps = task.get("steps")
    if not isinstance(steps, list) or not steps:
        raise OpenAIError("generated task must include non-empty steps list")

    for step in steps:
        action = step.get("action")
        if action not in ALLOWED_ACTIONS:
            raise OpenAIError(f"generated step action not allowed: {action}")
        if "step_id" not in step:
            raise OpenAIError("generated step missing step_id")
        if "risk_tier" not in step:
            step["risk_tier"] = "R0"
        if step["risk_tier"] not in {"R0", "R1", "R2", "R3"}:
            raise OpenAIError(f"invalid risk_tier: {step['risk_tier']}")
        step.setdefault("args", {})
        step.setdefault("retries", 1)
        step.setdefault("timeout_sec", 30)


def create_task_with_team(goal: str, serial: str = "") -> Dict[str, Any]:
    planner_model = os.getenv("OPENAI_MODEL_PLANNER", "gpt-5.4")
    operator_model = os.getenv("OPENAI_MODEL_OPERATOR", "codex")
    team_run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    trace_id = uuid.uuid4().hex
    tracer = AnywayTracer.from_env(scope=f"team-create:{team_run_id}", trace_id=trace_id)

    planner_prompt = f"""
You are the Planner Agent for an autonomous Android developer.
Return STRICT JSON only with this schema:
{{
  "objective": "...",
  "assumptions": ["..."],
  "plan": ["short atomic action 1", "short atomic action 2", "..."]
}}

Constraints:
- Goal: {goal}
- Device serial (if provided): {serial or "auto-detect"}
- Keep plan to 3-8 steps.
- Use only safe mobile-test actions.
""".strip()

    try:
        tracer.emit(
            "team.planner.started",
            text="team planner started",
            attributes={"team_run_id": team_run_id, "model": planner_model, "goal": goal},
        )
        planner_text = _call_openai(planner_model, planner_prompt)
        planner_json = _extract_json_object(planner_text)
        plan_lines = planner_json.get("plan", [])
        if not isinstance(plan_lines, list) or not plan_lines:
            raise OpenAIError("planner did not return a valid plan list")
        tracer.emit(
            "team.planner.completed",
            text="team planner completed",
            attributes={"team_run_id": team_run_id, "model": planner_model, "plan_steps": len(plan_lines)},
        )
    except Exception as exc:
        tracer.emit(
            "team.planner.failed",
            text="team planner failed",
            attributes={"team_run_id": team_run_id, "model": planner_model, "error": str(exc)},
        )
        raise

    allowed_actions = sorted(ALLOWED_ACTIONS)
    now = datetime.now(timezone.utc).isoformat()
    default_task_id = f"team-task-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    operator_prompt = f"""
You are the Operator Agent. Convert a plan into executable Android task JSON.
Return STRICT JSON only with this exact schema:
{{
  "task_id": "{default_task_id}",
  "goal": "{goal}",
  "created_at": "{now}",
  "steps": [
    {{
      "step_id": "s1",
      "action": "one of allowed actions",
      "risk_tier": "R0|R1|R2|R3",
      "args": {{}},
      "retries": 1,
      "timeout_sec": 30
    }}
  ],
  "metadata": {{"source": "team"}}
}}

Allowed actions only: {allowed_actions}
Plan to convert: {json.dumps(plan_lines)}
Rules:
- Always include android.detect as the first step.
- Keep actions safe and deterministic.
- Do not include actions outside allowlist.
- Use android.screenshot as final evidence step.
""".strip()

    try:
        tracer.emit(
            "team.operator.started",
            text="team operator started",
            attributes={"team_run_id": team_run_id, "model": operator_model, "goal": goal},
        )
        operator_text = _call_openai(operator_model, operator_prompt)
        task = _extract_json_object(operator_text)
        tracer.emit(
            "team.operator.completed",
            text="team operator completed",
            attributes={"team_run_id": team_run_id, "model": operator_model},
        )
    except Exception as exc:
        tracer.emit(
            "team.operator.failed",
            text="team operator failed",
            attributes={"team_run_id": team_run_id, "model": operator_model, "error": str(exc)},
        )
        raise

    # Force safe defaults in case the model omitted these.
    task.setdefault("task_id", default_task_id)
    task.setdefault("goal", goal)
    task.setdefault("created_at", now)
    task.setdefault("metadata", {})
    task["metadata"].setdefault("source", "team")
    task["metadata"]["trace_id"] = trace_id
    task["metadata"]["planner_model"] = planner_model
    task["metadata"]["operator_model"] = operator_model

    _validate_task(task)
    tracer.emit(
        "team.task.generated",
        text="team task generated",
        attributes={
            "team_run_id": team_run_id,
            "task_id": task["task_id"],
            "steps": len(task.get("steps", [])),
        },
    )
    return task


def write_task_file(task: Dict[str, Any], queue_dir: Path, filename: str = "") -> Path:
    queue_dir.mkdir(parents=True, exist_ok=True)
    if filename:
        path = queue_dir / filename
    else:
        path = queue_dir / f"{task['task_id']}.json"
    path.write_text(json.dumps(task, indent=2, sort_keys=True) + "\n")
    return path
