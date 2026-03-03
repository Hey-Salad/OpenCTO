import { describe, expect, it } from 'vitest'
import { pollDeviceToken, startDeviceAuthorization } from '../src/auth/deviceFlow'

describe('device flow', () => {
  it('starts authorization', async () => {
    const fetchImpl = async (): Promise<Response> => new Response(
      JSON.stringify({
        device_code: 'dev123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://auth.example.com/device',
        expires_in: 900,
        interval: 5,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )

    const response = await startDeviceAuthorization({
      deviceAuthorizationUrl: 'https://auth.example.com/device_authorize',
      clientId: 'client_1',
      fetchImpl,
    })

    expect(response.device_code).toBe('dev123')
  })

  it('polls until token success', async () => {
    let callCount = 0
    const fetchImpl = async (): Promise<Response> => {
      callCount += 1
      if (callCount === 1) {
        return new Response(
          JSON.stringify({ error: 'authorization_pending' }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({
          access_token: 'tok_123',
          refresh_token: 'ref_123',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    const result = await pollDeviceToken({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'client_1',
      deviceCode: 'dev_123',
      expiresInSeconds: 30,
      intervalSeconds: 0.001,
      fetchImpl,
    })

    expect(result.tokenSet.accessToken).toBe('tok_123')
    expect(callCount).toBeGreaterThan(1)
  })
})
