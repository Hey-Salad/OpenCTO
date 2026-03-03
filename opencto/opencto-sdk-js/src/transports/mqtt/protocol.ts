import { randomUUID } from 'node:crypto'
import type {
  MqttEnvelope,
  MqttProtocolVersion,
  MqttTaskAssignedPayload,
  MqttTaskCompletePayload,
  MqttTaskFailedPayload,
  MqttTaskNewPayload,
  MqttAgentHeartbeatPayload,
  MqttRunEventPayload,
} from '../../types/mqtt.js'

export const MQTT_PROTOCOL_VERSION: MqttProtocolVersion = 'mqtt-v1'

export type MqttEnvelopeType =
  | 'tasks.new'
  | 'tasks.assigned'
  | 'tasks.complete'
  | 'tasks.failed'
  | 'runs.event'
  | 'agents.heartbeat'

export type KnownPayloadByType = {
  'tasks.new': MqttTaskNewPayload
  'tasks.assigned': MqttTaskAssignedPayload
  'tasks.complete': MqttTaskCompletePayload
  'tasks.failed': MqttTaskFailedPayload
  'runs.event': MqttRunEventPayload
  'agents.heartbeat': MqttAgentHeartbeatPayload
}

export function createEnvelope<TType extends MqttEnvelopeType>(
  type: TType,
  payload: KnownPayloadByType[TType],
  context: {
    workspaceId: string
    agentId?: string
    correlationId?: string
    idempotencyKey?: string
    id?: string
  },
): MqttEnvelope<KnownPayloadByType[TType]> {
  return {
    id: context.id ?? randomUUID(),
    protocolVersion: MQTT_PROTOCOL_VERSION,
    type,
    timestamp: new Date().toISOString(),
    workspaceId: context.workspaceId,
    agentId: context.agentId,
    correlationId: context.correlationId,
    idempotencyKey: context.idempotencyKey,
    payload,
  }
}

export function parseEnvelope(input: unknown): MqttEnvelope<unknown> {
  if (!input || typeof input !== 'object') {
    throw new Error('MQTT message must be a JSON object')
  }

  const candidate = input as Partial<MqttEnvelope<unknown>>
  if (typeof candidate.id !== 'string' || !candidate.id) throw new Error('MQTT envelope is missing id')
  if (candidate.protocolVersion !== MQTT_PROTOCOL_VERSION) throw new Error('Unsupported MQTT protocol version')
  if (typeof candidate.type !== 'string' || !candidate.type) throw new Error('MQTT envelope is missing type')
  if (typeof candidate.timestamp !== 'string' || !candidate.timestamp) throw new Error('MQTT envelope is missing timestamp')
  if (typeof candidate.workspaceId !== 'string' || !candidate.workspaceId) throw new Error('MQTT envelope is missing workspaceId')
  if (typeof candidate.payload !== 'object' || candidate.payload === null) throw new Error('MQTT envelope is missing payload')

  return candidate as MqttEnvelope<unknown>
}

export function isEnvelopeType<TType extends MqttEnvelopeType>(
  envelope: MqttEnvelope<unknown>,
  expectedType: TType,
): envelope is MqttEnvelope<KnownPayloadByType[TType]> {
  return envelope.type === expectedType
}
