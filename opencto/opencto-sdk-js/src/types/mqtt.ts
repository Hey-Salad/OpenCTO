export type MqttProtocolVersion = 'mqtt-v1'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface MqttEnvelope<TPayload = unknown> {
  id: string
  protocolVersion: MqttProtocolVersion
  type: string
  timestamp: string
  workspaceId: string
  agentId?: string
  correlationId?: string
  idempotencyKey?: string
  payload: TPayload
}

export interface MqttTaskNewPayload {
  taskId: string
  taskType: string
  workflowId?: string
  priority?: TaskPriority
  input: Record<string, unknown>
}

export interface MqttTaskAssignedPayload {
  taskId: string
  assignedAt: string
  leaseMs?: number
}

export interface MqttTaskCompletePayload {
  taskId: string
  completedAt: string
  output?: Record<string, unknown>
  artifacts?: Array<{ id: string; kind: string; url?: string }>
}

export interface MqttTaskFailedPayload {
  taskId: string
  failedAt: string
  error: {
    code: string
    message: string
    retryable?: boolean
  }
  output?: Record<string, unknown>
}

export interface MqttRunEventPayload {
  runId: string
  eventType: string
  level: 'system' | 'info' | 'warn' | 'error'
  message: string
  data?: Record<string, unknown>
}

export interface MqttAgentHeartbeatPayload {
  status: 'alive' | 'degraded' | 'offline'
  role: string
  capabilities?: string[]
  uptimeSec?: number
  load?: {
    queuedTasks?: number
    activeTasks?: number
  }
}

export interface MqttTransportOptions {
  brokerUrl: string
  workspaceId: string
  agentId: string
  role?: string
  username?: string
  password?: string
  token?: string
  topicPrefix?: string
  dedupe?: MqttTransportDedupeOptions
}

export interface MqttTransportDedupeOptions {
  enabled?: boolean
  ttlMs?: number
  maxEntries?: number
  now?: () => number
}
