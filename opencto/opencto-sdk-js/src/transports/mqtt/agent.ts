import { randomUUID } from 'node:crypto'
import type {
  MqttEnvelope,
  MqttTaskNewPayload,
  MqttTransportOptions,
  MqttTaskAssignedPayload,
  MqttTaskCompletePayload,
  MqttTaskFailedPayload,
  MqttAgentHeartbeatPayload,
  MqttRunEventPayload,
} from '../../types/mqtt'
import { createMqttWireClient, type MqttWireClient } from './client'
import { createMqttEnvelopeDedupe } from './dedupe'
import { createEnvelope, isEnvelopeType, parseEnvelope } from './protocol'
import {
  topicTasksAssigned,
  topicTasksComplete,
  topicTasksFailed,
  topicTasksNew,
  topicRunsEvents,
  topicAgentsHeartbeat,
} from './topics'

export interface MqttAgentTransport {
  start(): Promise<void>
  stop(): Promise<void>
  onTask(handler: (envelope: MqttEnvelope<MqttTaskNewPayload>) => void): void
  publishTaskAssigned(payload: Omit<MqttTaskAssignedPayload, 'assignedAt'> & { assignedAt?: string }, context?: { correlationId?: string; idempotencyKey?: string }): Promise<void>
  publishTaskComplete(payload: Omit<MqttTaskCompletePayload, 'completedAt'> & { completedAt?: string }, context?: { correlationId?: string; idempotencyKey?: string }): Promise<void>
  publishTaskFailed(payload: Omit<MqttTaskFailedPayload, 'failedAt'> & { failedAt?: string }, context?: { correlationId?: string; idempotencyKey?: string }): Promise<void>
  publishRunEvent(payload: MqttRunEventPayload, context?: { correlationId?: string; idempotencyKey?: string }): Promise<void>
  publishHeartbeat(payload: MqttAgentHeartbeatPayload, context?: { correlationId?: string; idempotencyKey?: string }): Promise<void>
}

export function createMqttAgentTransport(
  options: MqttTransportOptions,
  wireClient?: MqttWireClient,
): MqttAgentTransport {
  const topicOptions = { workspaceId: options.workspaceId, topicPrefix: options.topicPrefix }
  const client = wireClient ?? createMqttWireClient({
    brokerUrl: options.brokerUrl,
    clientId: options.agentId || `opencto-agent-${randomUUID().slice(0, 12)}`,
    username: options.username,
    password: options.token ?? options.password,
  })

  let taskHandler: ((envelope: MqttEnvelope<MqttTaskNewPayload>) => void) | null = null
  const dedupe = options.dedupe?.enabled === false
    ? null
    : createMqttEnvelopeDedupe(options.dedupe)

  async function publishEnvelope(topic: string, envelope: MqttEnvelope): Promise<void> {
    await client.publish(topic, JSON.stringify(envelope))
  }

  return {
    async start() {
      await client.connect()
      await client.subscribe(topicTasksNew(topicOptions))
      client.onMessage((incoming) => {
        let envelope: MqttEnvelope
        try {
          envelope = parseEnvelope(JSON.parse(incoming.payloadText))
        } catch {
          return
        }

        if (isEnvelopeType(envelope, 'tasks.new')) {
          if (dedupe?.seen(envelope)) return
          taskHandler?.(envelope)
        }
      })
    },

    async stop() {
      await client.disconnect()
    },

    onTask(handler: (envelope: MqttEnvelope<MqttTaskNewPayload>) => void) {
      taskHandler = handler
    },

    async publishTaskAssigned(payload, context) {
      const envelope = createEnvelope('tasks.assigned', {
        ...payload,
        assignedAt: payload.assignedAt ?? new Date().toISOString(),
      }, {
        workspaceId: options.workspaceId,
        agentId: options.agentId,
        correlationId: context?.correlationId,
        idempotencyKey: context?.idempotencyKey,
      })
      await publishEnvelope(topicTasksAssigned(topicOptions), envelope)
    },

    async publishTaskComplete(payload, context) {
      const envelope = createEnvelope('tasks.complete', {
        ...payload,
        completedAt: payload.completedAt ?? new Date().toISOString(),
      }, {
        workspaceId: options.workspaceId,
        agentId: options.agentId,
        correlationId: context?.correlationId,
        idempotencyKey: context?.idempotencyKey,
      })
      await publishEnvelope(topicTasksComplete(topicOptions), envelope)
    },

    async publishTaskFailed(payload, context) {
      const envelope = createEnvelope('tasks.failed', {
        ...payload,
        failedAt: payload.failedAt ?? new Date().toISOString(),
      }, {
        workspaceId: options.workspaceId,
        agentId: options.agentId,
        correlationId: context?.correlationId,
        idempotencyKey: context?.idempotencyKey,
      })
      await publishEnvelope(topicTasksFailed(topicOptions), envelope)
    },

    async publishRunEvent(payload, context) {
      const envelope = createEnvelope('runs.event', payload, {
        workspaceId: options.workspaceId,
        agentId: options.agentId,
        correlationId: context?.correlationId,
        idempotencyKey: context?.idempotencyKey,
      })
      await publishEnvelope(topicRunsEvents(topicOptions), envelope)
    },

    async publishHeartbeat(payload, context) {
      const envelope = createEnvelope('agents.heartbeat', payload, {
        workspaceId: options.workspaceId,
        agentId: options.agentId,
        correlationId: context?.correlationId,
        idempotencyKey: context?.idempotencyKey,
      })
      await publishEnvelope(topicAgentsHeartbeat(topicOptions), envelope)
    },
  }
}
