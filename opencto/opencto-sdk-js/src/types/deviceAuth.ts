import type { FetchLike } from './common.js'

export interface DeviceAuthorizationResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval?: number
}

export interface DeviceTokenSuccessResponse {
  access_token: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

export interface DeviceTokenPendingResponse {
  error: 'authorization_pending' | 'slow_down' | 'access_denied' | 'expired_token'
  error_description?: string
}

export interface DeviceFlowStartOptions {
  deviceAuthorizationUrl: string
  clientId: string
  scope?: string
  audience?: string
  extra?: Record<string, string>
  fetchImpl?: FetchLike
}

export interface DeviceFlowPollOptions {
  tokenUrl: string
  clientId: string
  deviceCode: string
  intervalSeconds?: number
  expiresInSeconds: number
  fetchImpl?: FetchLike
  signal?: AbortSignal
}

export interface OpenCtoTokenSet {
  accessToken: string
  tokenType?: string
  refreshToken?: string
  scope?: string
  expiresIn?: number
  issuedAt: string
}

export interface DeviceFlowResult {
  tokenSet: OpenCtoTokenSet
}
