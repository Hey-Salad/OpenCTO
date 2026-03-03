import { setTimeout as sleep } from 'node:timers/promises'
import type {
  DeviceAuthorizationResponse,
  DeviceFlowPollOptions,
  DeviceFlowResult,
  DeviceFlowStartOptions,
  DeviceTokenPendingResponse,
  DeviceTokenSuccessResponse,
  OpenCtoTokenSet,
} from '../types/deviceAuth'
import type { FetchLike } from '../types/common'

function getFetch(fetchImpl?: FetchLike): FetchLike {
  return fetchImpl ?? globalThis.fetch.bind(globalThis)
}

function toTokenSet(token: DeviceTokenSuccessResponse): OpenCtoTokenSet {
  return {
    accessToken: token.access_token,
    tokenType: token.token_type,
    refreshToken: token.refresh_token,
    scope: token.scope,
    expiresIn: token.expires_in,
    issuedAt: new Date().toISOString(),
  }
}

export async function startDeviceAuthorization(options: DeviceFlowStartOptions): Promise<DeviceAuthorizationResponse> {
  const fetchImpl = getFetch(options.fetchImpl)

  const body = new URLSearchParams({
    client_id: options.clientId,
  })

  if (options.scope) body.set('scope', options.scope)
  if (options.audience) body.set('audience', options.audience)
  for (const [key, value] of Object.entries(options.extra ?? {})) {
    body.set(key, value)
  }

  const response = await fetchImpl(options.deviceAuthorizationUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  const parsed = (await response.json()) as Partial<DeviceAuthorizationResponse> & { error?: string; error_description?: string }
  if (!response.ok) {
    throw new Error(parsed.error_description || parsed.error || 'Failed to start device authorization')
  }

  if (!parsed.device_code || !parsed.user_code || !parsed.verification_uri || !parsed.expires_in) {
    throw new Error('Device authorization response is missing required fields')
  }

  return {
    device_code: parsed.device_code,
    user_code: parsed.user_code,
    verification_uri: parsed.verification_uri,
    verification_uri_complete: parsed.verification_uri_complete,
    expires_in: parsed.expires_in,
    interval: parsed.interval,
  }
}

export async function pollDeviceToken(options: DeviceFlowPollOptions): Promise<DeviceFlowResult> {
  const fetchImpl = getFetch(options.fetchImpl)
  const startedAt = Date.now()
  const ttlMs = options.expiresInSeconds * 1000
  let intervalMs = Math.max(1, options.intervalSeconds ?? 5) * 1000

  while (Date.now() - startedAt < ttlMs) {
    if (options.signal?.aborted) {
      throw new Error('Device flow polling aborted')
    }

    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: options.clientId,
      device_code: options.deviceCode,
    })

    const response = await fetchImpl(options.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: options.signal,
    })

    const parsed = (await response.json()) as Partial<DeviceTokenSuccessResponse & DeviceTokenPendingResponse> & {
      error_description?: string
    }

    if (response.ok && parsed.access_token) {
      return { tokenSet: toTokenSet(parsed as DeviceTokenSuccessResponse) }
    }

    const code = parsed.error
    if (code === 'authorization_pending') {
      await sleep(intervalMs, undefined, { signal: options.signal })
      continue
    }

    if (code === 'slow_down') {
      intervalMs += 2000
      await sleep(intervalMs, undefined, { signal: options.signal })
      continue
    }

    if (code === 'access_denied') {
      throw new Error(parsed.error_description || 'User denied device authorization request')
    }

    if (code === 'expired_token') {
      throw new Error(parsed.error_description || 'Device authorization expired')
    }

    throw new Error(parsed.error_description || String(code) || 'Token polling failed')
  }

  throw new Error('Device authorization timed out before completion')
}

export async function runDeviceFlow(input: {
  start: DeviceFlowStartOptions
  poll: Omit<DeviceFlowPollOptions, 'deviceCode' | 'expiresInSeconds' | 'intervalSeconds'>
}): Promise<{ device: DeviceAuthorizationResponse; result: DeviceFlowResult }> {
  const device = await startDeviceAuthorization(input.start)
  const result = await pollDeviceToken({
    ...input.poll,
    deviceCode: device.device_code,
    expiresInSeconds: device.expires_in,
    intervalSeconds: device.interval,
  })
  return { device, result }
}
