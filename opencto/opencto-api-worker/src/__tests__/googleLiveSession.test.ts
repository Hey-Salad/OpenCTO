import { afterEach, describe, expect, it } from 'vitest'
import worker from '../index'
import type { Env } from '../types'

describe('Google live session bootstrap', () => {
  afterEach(() => {
    // no-op placeholder for symmetry with other endpoint tests
  })

  it('returns clear config error when GOOGLE_LIVE_BACKEND_URL is missing', async () => {
    const env = createMockEnv({ GOOGLE_LIVE_BACKEND_URL: '' })

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/google-live/session', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: 'gemini-2.5-flash-native-audio-preview-12-2025' }),
      }),
      env,
    )

    const body = await res.json() as { error?: string; code?: string }
    expect(res.status).toBe(500)
    expect(body.code).toBe('CONFIG_ERROR')
    expect(body.error).toContain('GOOGLE_LIVE_BACKEND_URL')
  })

  it('returns clear config error when GOOGLE_LIVE_SHARED_SECRET is missing', async () => {
    const env = createMockEnv({ GOOGLE_LIVE_SHARED_SECRET: '' })

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/google-live/session', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: 'gemini-2.5-flash-native-audio-preview-12-2025' }),
      }),
      env,
    )

    const body = await res.json() as { error?: string; code?: string }
    expect(res.status).toBe(500)
    expect(body.code).toBe('CONFIG_ERROR')
    expect(body.error).toContain('GOOGLE_LIVE_SHARED_SECRET')
  })

  it('returns websocket bootstrap payload for configured backend', async () => {
    const env = createMockEnv({
      GOOGLE_LIVE_BACKEND_URL: 'https://google-live.opencto.works',
      GOOGLE_LIVE_SHARED_SECRET: 'google-live-secret',
      API_BASE_URL: 'https://api.opencto.works',
    })

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/google-live/session', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo-token',
          'content-type': 'application/json',
          'x-opencto-session-id': 'session-test-1',
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          workspaceId: 'demo',
        }),
      }),
      env,
    )

    const body = await res.json() as {
      provider?: string
      mode?: string
      wsUrl?: string
      websocketUrl?: string
      sessionToken?: string
      workspaceId?: string
      sessionId?: string
    }

    expect(res.status).toBe(200)
    expect(body.provider).toBe('google_vertex')
    expect(body.mode).toBe('vertex_live')
    expect(body.wsUrl).toBe('wss://google-live.opencto.works/ws/live')
    expect(body.websocketUrl).toBe('wss://google-live.opencto.works/ws/live')
    expect(body.workspaceId).toBe('demo')
    expect(body.sessionId).toBe('session-test-1')
    expect(typeof body.sessionToken).toBe('string')
    expect(body.sessionToken?.split('.')).toHaveLength(3)
  })

  it('falls back to the default allowed model when the request is unsupported', async () => {
    const env = createMockEnv({
      GOOGLE_LIVE_SHARED_SECRET: 'google-live-secret',
      GOOGLE_LIVE_ALLOWED_MODELS: 'gemini-2.5-flash-native-audio-preview-09-2025',
      GOOGLE_LIVE_DEFAULT_MODEL: 'gemini-2.5-flash-native-audio-preview-09-2025',
    })

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/google-live/session', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: 'gemini-2.5-flash-native-audio-preview-12-2025' }),
      }),
      env,
    )

    const body = await res.json() as { model?: string }
    expect(res.status).toBe(200)
    expect(body.model).toBe('gemini-2.5-flash-native-audio-preview-09-2025')
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
    GOOGLE_LIVE_BACKEND_URL: 'https://google-live.opencto.works',
    GOOGLE_LIVE_SHARED_SECRET: 'google-live-secret',
    ...overrides,
  }
}
