import type { RealtimeTokenResponse } from '../types/realtime.js'
import type { HttpClientOptions } from '../core/http.js'
import { createHttpClient } from '../core/http.js'

export interface RealtimeClient {
  createToken(model?: string): Promise<RealtimeTokenResponse>
}

export function createRealtimeClient(options: HttpClientOptions): RealtimeClient {
  const http = createHttpClient(options)

  return {
    createToken(model?: string) {
      return http.post<RealtimeTokenResponse>(
        '/api/v1/realtime/token',
        model ? { model } : {},
        'Failed to create realtime token',
      )
    },
  }
}
