# MQTT Protocol v1

This document defines OpenCTO's MQTT transport contract for orchestrator/agent messaging.

## Version

- `protocolVersion`: `mqtt-v1`

## Envelope

All MQTT payloads must use this envelope:

```json
{
  "id": "uuid",
  "protocolVersion": "mqtt-v1",
  "type": "tasks.new",
  "timestamp": "2026-03-03T00:00:00.000Z",
  "workspaceId": "ws_123",
  "agentId": "agent_abc",
  "correlationId": "run_123",
  "idempotencyKey": "task_123_attempt_1",
  "payload": {}
}
```

## Topic namespace

Root: `{topicPrefix}/workspace/{workspaceId}`

Default `topicPrefix`: `opencto`

## Topics

- `.../tasks/new`
- `.../tasks/assigned`
- `.../tasks/complete`
- `.../tasks/failed`
- `.../runs/events`
- `.../agents/heartbeat`

## Message types

### `tasks.new`

```json
{
  "taskId": "task_123",
  "taskType": "workflow.execute",
  "workflowId": "landing-page-builder",
  "priority": "high",
  "input": { "prompt": "Build launch page" }
}
```

### `tasks.assigned`

```json
{
  "taskId": "task_123",
  "assignedAt": "2026-03-03T00:00:01.000Z",
  "leaseMs": 300000
}
```

### `tasks.complete`

```json
{
  "taskId": "task_123",
  "completedAt": "2026-03-03T00:00:20.000Z",
  "output": { "status": "ok" },
  "artifacts": [{ "id": "a1", "kind": "html", "url": "https://..." }]
}
```

### `tasks.failed`

```json
{
  "taskId": "task_123",
  "failedAt": "2026-03-03T00:00:20.000Z",
  "error": {
    "code": "UPSTREAM_FAILURE",
    "message": "Provider timeout",
    "retryable": true
  }
}
```

### `runs.event`

```json
{
  "runId": "run_123",
  "eventType": "step.completed",
  "level": "info",
  "message": "Generated first draft",
  "data": { "step": "draft" }
}
```

### `agents.heartbeat`

```json
{
  "status": "alive",
  "role": "content",
  "capabilities": ["video.generate", "copy.write"],
  "uptimeSec": 1234,
  "load": {
    "queuedTasks": 2,
    "activeTasks": 1
  }
}
```

## Reliability rules

- Publishers should set `idempotencyKey` for retryable operations.
- Consumers should dedupe by `(workspaceId, idempotencyKey)` where available.
- `qos=1` is recommended for task and completion topics.
- `correlationId` should map to run/workflow execution id.

## Security guidance

- Enforce broker auth and ACL per workspace.
- Never accept cross-workspace publishes.
- Validate `protocolVersion` and envelope shape.
- Reject malformed payloads early.

