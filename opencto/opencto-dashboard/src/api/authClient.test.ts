import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthHttpClient } from './authClient'

describe('AuthHttpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('normalizes auth/session failures with status and code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const client = new AuthHttpClient('https://api.example.com/api/v1')

    await expect(client.getSession()).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
      status: 401,
    })
  })

  it('clears stored token during signOut', () => {
    window.localStorage.setItem('opencto_auth_token', 'token-123')

    const client = new AuthHttpClient('https://api.example.com/api/v1')
    client.signOut()

    expect(window.localStorage.getItem('opencto_auth_token')).toBeNull()
  })
})
