import { describe, expect, it } from 'vitest'
import { createMqttAgentTransport } from '../src/transports/mqtt/agent'
import { createMqttEnvelopeDedupe } from '../src/transports/mqtt/dedupe'
import { createMqttOrchestratorTransport } from '../src/transports/mqtt/orchestrator'
import { createEnvelope } from '../src/transports/mqtt/protocol'
import type { MqttIncomingMessage, MqttWireClient } from '../src/transports/mqtt/client'

function createWireHarness() {
  let onMessage: ((message: MqttIncomingMessage) => void) | null = null

  const wireClient: MqttWireClient = {
    async connect() {},
    async publish() {},
    async subscribe() {},
    onMessage(handler) {
      onMessage = handler
    },
    async disconnect() {},
    isConnected() {
      return true
    },
  }

  return {
    wireClient,
    emit(envelope: unknown) {
      onMessage?.({
        topic: 'opencto/workspace/ws_1/tasks/new',
        payloadText: JSON.stringify(envelope),
      })
    },
  }
}

describe('mqtt dedupe utility', () => {
  it('dedupes by workspace + idempotency key', () => {
    const dedupe = createMqttEnvelopeDedupe()
    const first = createEnvelope('tasks.new', {
      taskId: 'task_1',
      taskType: 'workflow.execute',
      input: {},
    }, {
      id: 'msg_1',
      workspaceId: 'ws_1',
      idempotencyKey: 'idem_1',
    })
    const duplicate = createEnvelope('tasks.new', {
      taskId: 'task_2',
      taskType: 'workflow.execute',
      input: {},
    }, {
      id: 'msg_2',
      workspaceId: 'ws_1',
      idempotencyKey: 'idem_1',
    })
    const otherWorkspace = createEnvelope('tasks.new', {
      taskId: 'task_3',
      taskType: 'workflow.execute',
      input: {},
    }, {
      id: 'msg_3',
      workspaceId: 'ws_2',
      idempotencyKey: 'idem_1',
    })

    expect(dedupe.seen(first)).toBe(false)
    expect(dedupe.seen(duplicate)).toBe(true)
    expect(dedupe.seen(otherWorkspace)).toBe(false)
  })

  it('falls back to envelope id and respects ttl', () => {
    let nowMs = 1_000
    const dedupe = createMqttEnvelopeDedupe({
      ttlMs: 100,
      now: () => nowMs,
    })
    const envelope = createEnvelope('tasks.new', {
      taskId: 'task_1',
      taskType: 'workflow.execute',
      input: {},
    }, {
      id: 'msg_1',
      workspaceId: 'ws_1',
    })

    expect(dedupe.seen(envelope)).toBe(false)
    expect(dedupe.seen(envelope)).toBe(true)

    nowMs += 150
    expect(dedupe.seen(envelope)).toBe(false)
  })
})

describe('mqtt transports dedupe', () => {
  it('drops duplicate inbound tasks by default on agent transport', async () => {
    const harness = createWireHarness()
    const transport = createMqttAgentTransport({
      brokerUrl: 'mqtt://localhost:1883',
      workspaceId: 'ws_1',
      agentId: 'agent_1',
    }, harness.wireClient)

    const received: string[] = []
    transport.onTask((envelope) => {
      received.push(envelope.id)
    })

    await transport.start()
    harness.emit(createEnvelope('tasks.new', {
      taskId: 'task_1',
      taskType: 'workflow.execute',
      input: {},
    }, {
      id: 'msg_1',
      workspaceId: 'ws_1',
      idempotencyKey: 'idem_1',
    }))
    harness.emit(createEnvelope('tasks.new', {
      taskId: 'task_1',
      taskType: 'workflow.execute',
      input: {},
    }, {
      id: 'msg_2',
      workspaceId: 'ws_1',
      idempotencyKey: 'idem_1',
    }))
    harness.emit(createEnvelope('tasks.new', {
      taskId: 'task_1',
      taskType: 'workflow.execute',
      input: {},
    }, {
      id: 'msg_3',
      workspaceId: 'ws_1',
      idempotencyKey: 'idem_2',
    }))

    expect(received).toEqual(['msg_1', 'msg_3'])
  })

  it('allows duplicate inbound events when dedupe is disabled', async () => {
    const harness = createWireHarness()
    const transport = createMqttOrchestratorTransport({
      brokerUrl: 'mqtt://localhost:1883',
      workspaceId: 'ws_1',
      agentId: 'orchestrator_1',
      dedupe: { enabled: false },
    }, harness.wireClient)

    const received: string[] = []
    transport.onTaskComplete((envelope) => {
      received.push(envelope.id)
    })

    await transport.start()
    harness.emit(createEnvelope('tasks.complete', {
      taskId: 'task_1',
      completedAt: new Date().toISOString(),
    }, {
      id: 'msg_1',
      workspaceId: 'ws_1',
      idempotencyKey: 'idem_1',
    }))
    harness.emit(createEnvelope('tasks.complete', {
      taskId: 'task_1',
      completedAt: new Date().toISOString(),
    }, {
      id: 'msg_2',
      workspaceId: 'ws_1',
      idempotencyKey: 'idem_1',
    }))

    expect(received).toEqual(['msg_1', 'msg_2'])
  })
})
