import { createAuthClient, type AuthClient } from './clients/auth.js'
import { createChatsClient, type ChatsClient } from './clients/chats.js'
import { createRunsClient, type RunsClient } from './clients/runs.js'
import { createRealtimeClient, type RealtimeClient } from './clients/realtime.js'
import type { FetchLike } from './types/common.js'

export * from './types/index.js'
export * from './transports/mqtt/index.js'
export * from './auth/index.js'
export { codeFromStatus, createOpenCtoError, normalizeError } from './core/errors.js'
export { createAuthClient, createChatsClient, createRunsClient, createRealtimeClient }

export interface OpenCtoClientOptions {
  baseUrl: string
  getToken?: () => string | null | Promise<string | null>
  fetchImpl?: FetchLike
  defaultHeaders?: Record<string, string>
}

export interface OpenCtoClient {
  auth: AuthClient
  chats: ChatsClient
  runs: RunsClient
  realtime: RealtimeClient
}

export function createOpenCtoClient(options: OpenCtoClientOptions): OpenCtoClient {
  return {
    auth: createAuthClient(options),
    chats: createChatsClient(options),
    runs: createRunsClient(options),
    realtime: createRealtimeClient(options),
  }
}
