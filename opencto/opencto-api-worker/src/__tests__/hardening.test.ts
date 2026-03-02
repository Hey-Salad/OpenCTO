import { describe, it, expect } from 'vitest'
import worker from '../index'
import type { Env } from '../types'

describe('Auth and billing hardening', () => {
  it('returns a clear 401 payload when authorization is missing', async () => {
    const env = createMockEnv({ ENVIRONMENT: 'production' })

    const res = await worker.fetch(new Request('https://api.opencto.works/api/v1/auth/session'), env)
    const body = await res.json() as { code?: string; status?: number; error?: string }

    expect(res.status).toBe(401)
    expect(body.code).toBe('UNAUTHORIZED')
    expect(body.status).toBe(401)
    expect(body.error).toContain('Missing authorization')
  })

  it('returns a clear 401 payload when bearer token is invalid', async () => {
    const env = createMockEnv({ ENVIRONMENT: 'production' })

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/auth/session', {
        headers: {
          Authorization: 'Bearer invalid-session-token',
        },
      }),
      env,
    )
    const body = await res.json() as { code?: string; status?: number }

    expect(res.status).toBe(401)
    expect(body.code).toBe('UNAUTHORIZED')
    expect(body.status).toBe(401)
  })

  it('returns config error when JWT secret is missing for OAuth start', async () => {
    const env = createMockEnv({ JWT_SECRET: '' })

    const res = await worker.fetch(new Request('https://api.opencto.works/api/v1/auth/oauth/github/start'), env)
    const body = await res.json() as { code?: string; status?: number; error?: string }

    expect(res.status).toBe(500)
    expect(body.code).toBe('CONFIG_ERROR')
    expect(body.status).toBe(500)
    expect(body.error).toContain('JWT_SECRET')
  })

  it('returns clear denied response when GitHub OAuth callback includes provider error', async () => {
    const env = createMockEnv()

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/auth/oauth/github/callback?error=access_denied&error_description=cancelled'),
      env,
    )
    const body = await res.json() as {
      code?: string
      status?: number
      details?: { providerError?: string; providerErrorDescription?: string }
    }

    expect(res.status).toBe(401)
    expect(body.code).toBe('OAUTH_DENIED')
    expect(body.status).toBe(401)
    expect(body.details?.providerError).toBe('access_denied')
  })

  it('rejects invalid billing intervals with a 400 payload', async () => {
    const env = createMockEnv({ ENVIRONMENT: 'development' })

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/billing/checkout/session', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ planCode: 'TEAM', interval: 'WEEKLY' }),
      }),
      env,
    )
    const body = await res.json() as { code?: string; status?: number; error?: string }

    expect(res.status).toBe(400)
    expect(body.code).toBe('BAD_REQUEST')
    expect(body.status).toBe(400)
    expect(body.error).toContain('Invalid billing interval')
  })

  it('rejects Stripe webhooks with invalid content-type', async () => {
    const env = createMockEnv()

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/billing/webhooks/stripe', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          'stripe-signature': 'sig_test',
        },
        body: JSON.stringify({ id: 'evt_123' }),
      }),
      env,
    )
    const body = await res.json() as { code?: string; status?: number; error?: string }

    expect(res.status).toBe(400)
    expect(body.code).toBe('BAD_REQUEST')
    expect(body.status).toBe(400)
    expect(body.error).toContain('content-type')
  })

  it('returns clear 500 when Stripe webhook secret is missing', async () => {
    const env = createMockEnv({ STRIPE_WEBHOOK_SECRET: '' })

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/billing/webhooks/stripe', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': 'sig_test',
        },
        body: JSON.stringify({ id: 'evt_123' }),
      }),
      env,
    )
    const body = await res.json() as { code?: string; status?: number; error?: string }

    expect(res.status).toBe(500)
    expect(body.code).toBe('INTERNAL_SERVER_ERROR')
    expect(body.status).toBe(500)
    expect(body.error).toContain('STRIPE_WEBHOOK_SECRET')
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
