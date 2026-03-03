import { createAuthClient, type AuthClient } from './clients/auth'
import { createChatsClient, type ChatsClient } from './clients/chats'
import { createRunsClient, type RunsClient } from './clients/runs'
import { createRealtimeClient, type RealtimeClient } from './clients/realtime'
import type { FetchLike } from './types/common'

export * from './types'
export * from './transports/mqtt'
export * from './auth'
export { codeFromStatus, createOpenCtoError, normalizeError } from './core/errors'
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
