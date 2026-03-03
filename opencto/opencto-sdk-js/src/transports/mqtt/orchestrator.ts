import { randomUUID } from 'node:crypto'
import type {
  MqttEnvelope,
  MqttTaskNewPayload,
  MqttTaskAssignedPayload,
  MqttTaskCompletePayload,
  MqttTaskFailedPayload,
  MqttAgentHeartbeatPayload,
  MqttTransportOptions,
} from '../../types/mqtt'
import { createMqttWireClient, type MqttWireClient } from './client'
import { createMqttEnvelopeDedupe } from './dedupe'
import { publishWithRetry } from './retry'
import {
  createEnvelope,
  isEnvelopeType,
  parseEnvelope,
} from './protocol'
import {
  topicTasksNew,
  topicTasksAssigned,
  topicTasksComplete,
  topicTasksFailed,
  topicAgentsHeartbeat,
} from './topics'

export interface MqttOrchestratorTransport {
  start(): Promise<void>
  stop(): Promise<void>
  publishTaskNew(payload: MqttTaskNewPayload, context?: { correlationId?: string; idempotencyKey?: string }): Promise<void>
  onTaskAssigned(handler: (envelope: MqttEnvelope<MqttTaskAssignedPayload>) => void): void
  onTaskComplete(handler: (envelope: MqttEnvelope<MqttTaskCompletePayload>) => void): void
  onTaskFailed(handler: (envelope: MqttEnvelope<MqttTaskFailedPayload>) => void): void
  onAgentHeartbeat(handler: (envelope: MqttEnvelope<MqttAgentHeartbeatPayload>) => void): void
}

export function createMqttOrchestratorTransport(
  options: MqttTransportOptions,
  wireClient?: MqttWireClient,
): MqttOrchestratorTransport {
  const topicOptions = { workspaceId: options.workspaceId, topicPrefix: options.topicPrefix }
  const client = wireClient ?? createMqttWireClient({
    brokerUrl: options.brokerUrl,
    clientId: options.agentId || `opencto-orchestrator-${randomUUID().slice(0, 12)}`,
    username: options.username,
    password: options.token ?? options.password,
  })

  let onAssigned: ((envelope: MqttEnvelope<MqttTaskAssignedPayload>) => void) | null = null
  let onComplete: ((envelope: MqttEnvelope<MqttTaskCompletePayload>) => void) | null = null
  let onFailed: ((envelope: MqttEnvelope<MqttTaskFailedPayload>) => void) | null = null
  let onHeartbeat: ((envelope: MqttEnvelope<MqttAgentHeartbeatPayload>) => void) | null = null
  const dedupe = options.dedupe?.enabled === false
    ? null
    : createMqttEnvelopeDedupe(options.dedupe)

  return {
    async start() {
      await client.connect()
      await client.subscribe([
        topicTasksAssigned(topicOptions),
        topicTasksComplete(topicOptions),
        topicTasksFailed(topicOptions),
        topicAgentsHeartbeat(topicOptions),
      ])

      client.onMessage((incoming) => {
        let envelope: MqttEnvelope
        try {
          envelope = parseEnvelope(JSON.parse(incoming.payloadText))
        } catch {
          return
        }
        if (dedupe?.seen(envelope)) return

        if (isEnvelopeType(envelope, 'tasks.assigned')) onAssigned?.(envelope)
        if (isEnvelopeType(envelope, 'tasks.complete')) onComplete?.(envelope)
        if (isEnvelopeType(envelope, 'tasks.failed')) onFailed?.(envelope)
        if (isEnvelopeType(envelope, 'agents.heartbeat')) onHeartbeat?.(envelope)
      })
    },

    async stop() {
      await client.disconnect()
    },

    async publishTaskNew(payload, context) {
      const envelope = createEnvelope('tasks.new', payload, {
        workspaceId: options.workspaceId,
        agentId: options.agentId,
        correlationId: context?.correlationId,
        idempotencyKey: context?.idempotencyKey,
      })
      await publishWithRetry(
        () => client.publish(topicTasksNew(topicOptions), JSON.stringify(envelope)),
        options.delivery,
      )
    },

    onTaskAssigned(handler) {
      onAssigned = handler
    },

    onTaskComplete(handler) {
      onComplete = handler
    },

    onTaskFailed(handler) {
      onFailed = handler
    },

    onAgentHeartbeat(handler) {
      onHeartbeat = handler
    },
  }
}
