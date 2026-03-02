import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../index'
import type { Env } from '../types'

describe('Realtime token endpoint hardening', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns clear config error when OPENAI_API_KEY is missing', async () => {
    const env = createMockEnv({ OPENAI_API_KEY: '', ENVIRONMENT: 'development' })

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/realtime/token', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: 'gpt-realtime-1.5' }),
      }),
      env,
    )

    const body = await res.json() as { error?: string; code?: string }
    expect(res.status).toBe(500)
    expect(body.code).toBe('CONFIG_ERROR')
    expect(body.error).toContain('OPENAI_API_KEY')
  })

  it('returns 502 when OpenAI client secret minting request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

    const env = createMockEnv({ ENVIRONMENT: 'development' })

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/realtime/token', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: 'gpt-realtime-1.5' }),
      }),
      env,
    )

    const body = await res.json() as { error?: string; detail?: string }
    expect(res.status).toBe(502)
    expect(body.error).toBe('Fetch to OpenAI failed')
    expect(body.detail).toContain('network down')
  })
})

function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    OPENAI_API_KEY: 'sk-test-mock',
    STRIPE_SECRET_KEY: 'sk_test_mock',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_mock',
    JWT_SECRET: 'jwt_secret_mock',
    WEBAUTHN_RP_ID: 'opencto.works',
    WEBAUTHN_RP_NAME: 'OpenCTO',
    ENVIRONMENT: 'test',
    VERCEL_TOKEN: 'vercel-test-mock',
    CF_API_TOKEN: 'cf-test-mock',
    CF_ACCOUNT_ID: 'cf-account-mock',
    GITHUB_TOKEN: 'github-test-mock',
    GITHUB_OAUTH_CLIENT_ID: 'github-oauth-client-id-mock',
    GITHUB_OAUTH_CLIENT_SECRET: 'github-oauth-client-secret-mock',
    API_BASE_URL: 'https://api.opencto.works',
    OPENCTO_AGENT_BASE_URL: 'https://cloud-services-api.opencto.works',
    APP_BASE_URL: 'https://app.opencto.works',
    ...overrides,
  }
}
