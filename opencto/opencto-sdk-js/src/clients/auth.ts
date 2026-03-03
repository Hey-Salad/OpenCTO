import type { AuthSession } from '../types/auth'
import type { HttpClientOptions } from '../core/http'
import { createHttpClient } from '../core/http'

export interface AuthClient {
  getSession(): Promise<AuthSession>
  deleteAccount(): Promise<{ deleted: boolean }>
}

export function createAuthClient(options: HttpClientOptions): AuthClient {
  const http = createHttpClient(options)

  return {
    getSession() {
      return http.get<AuthSession>('/api/v1/auth/session', 'Failed to load auth session')
    },

    deleteAccount() {
      return http.delete<{ deleted: boolean }>('/api/v1/auth/account', 'Failed to delete account')
    },
  }
}
