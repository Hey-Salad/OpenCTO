import { describe, expect, it } from 'vitest'
import { createMqttAgentTransport } from '../src/transports/mqtt/agent'
import type { MqttWireClient } from '../src/transports/mqtt/client'
import { publishWithRetry } from '../src/transports/mqtt/retry'

describe('mqtt publish retry helper', () => {
  it('retries and succeeds before max attempts', async () => {
    let attempts = 0
    const sleeps: number[] = []
    await publishWithRetry(async () => {
      attempts += 1
      if (attempts < 3) throw new Error('transient')
    }, {
      maxAttempts: 3,
      initialBackoffMs: 10,
      backoffMultiplier: 2,
      maxBackoffMs: 100,
      jitterRatio: 0,
      sleep: async (ms) => {
        sleeps.push(ms)
      },
    })

    expect(attempts).toBe(3)
    expect(sleeps).toEqual([10, 20])
  })

  it('fails fast when retries are disabled', async () => {
    let attempts = 0
    await expect(publishWithRetry(async () => {
      attempts += 1
      throw new Error('boom')
    }, {
      enabled: false,
      sleep: async () => {},
    })).rejects.toThrow('MQTT publish failed after 1 attempt(s)')

    expect(attempts).toBe(1)
  })
})

describe('mqtt transports publish retry', () => {
  it('agent publish retries transient failures', async () => {
    let publishCalls = 0
    const wireClient: MqttWireClient = {
      async connect() {},
      async subscribe() {},
      async publish() {
        publishCalls += 1
        if (publishCalls < 2) {
          throw new Error('transient publish failure')
        }
      },
      onMessage() {},
      async disconnect() {},
      isConnected() {
        return true
      },
    }

    const transport = createMqttAgentTransport({
      brokerUrl: 'mqtt://localhost:1883',
      workspaceId: 'ws_1',
      agentId: 'agent_1',
      delivery: {
        maxAttempts: 2,
        initialBackoffMs: 1,
        maxBackoffMs: 1,
        jitterRatio: 0,
        sleep: async () => {},
      },
    }, wireClient)

    await transport.publishTaskAssigned({ taskId: 'task_1' })
    expect(publishCalls).toBe(2)
  })
})
