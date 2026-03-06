import { describe, expect, it } from 'vitest'
import { createEnvelope, isEnvelopeType, parseEnvelope } from '../src/transports/mqtt/protocol'
import {
  topicTasksNew,
  topicTasksAssigned,
  topicTasksComplete,
  topicTasksFailed,
  topicRunsEvents,
  topicAgentsHeartbeat,
} from '../src/transports/mqtt/topics'

describe('mqtt protocol', () => {
  it('creates and parses envelope', () => {
    const envelope = createEnvelope('tasks.new', {
      taskId: 'task_1',
      taskType: 'workflow.execute',
      input: { a: 1 },
    }, {
      workspaceId: 'ws_1',
      agentId: 'agent_1',
    })

    const parsed = parseEnvelope(envelope)
    expect(parsed.protocolVersion).toBe('mqtt-v1')
    expect(isEnvelopeType(parsed, 'tasks.new')).toBe(true)
  })

  it('rejects malformed envelope', () => {
    expect(() => parseEnvelope({})).toThrow()
  })
})

describe('mqtt topics', () => {
  const opts = { workspaceId: 'ws_1', topicPrefix: 'opencto' }

  it('builds workspace topics', () => {
    expect(topicTasksNew(opts)).toBe('opencto/workspace/ws_1/tasks/new')
    expect(topicTasksAssigned(opts)).toBe('opencto/workspace/ws_1/tasks/assigned')
    expect(topicTasksComplete(opts)).toBe('opencto/workspace/ws_1/tasks/complete')
    expect(topicTasksFailed(opts)).toBe('opencto/workspace/ws_1/tasks/failed')
    expect(topicRunsEvents(opts)).toBe('opencto/workspace/ws_1/runs/events')
    expect(topicAgentsHeartbeat(opts)).toBe('opencto/workspace/ws_1/agents/heartbeat')
  })
})
