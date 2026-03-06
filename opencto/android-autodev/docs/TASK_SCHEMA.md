# Task Schema (v1)

```json
{
  "task_id": "task-001",
  "goal": "Open app and capture screenshot",
  "created_at": "2026-03-06T00:00:00Z",
  "steps": [
    {
      "step_id": "s1",
      "action": "android.detect",
      "risk_tier": "R0",
      "args": {},
      "retries": 1,
      "timeout_sec": 20
    }
  ],
  "metadata": {
    "source": "manual"
  }
}
```

## Actions

- `android.detect`
- `android.launch` (`package`, optional `activity`)
- `android.tap` (`x`, `y`)
- `android.text` (`text`)
- `android.key` (`keycode`)
- `android.screenshot`

## Risk tiers

- `R0`: auto allowed
- `R1`: low-risk mutable action
- `R2`: approval token required
- `R3`: approval token required (reserved for higher control)

Use `approval_token` on a step when `risk_tier` is `R2` or `R3`.
