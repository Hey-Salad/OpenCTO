import { describe, expect, it } from 'vitest'
import { createOpenCtoClient } from '../src'

describe('opencto client', () => {
  it('builds clients and hits auth endpoint', async () => {
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      if (String(input).endsWith('/api/v1/auth/session')) {
        return new Response(
          JSON.stringify({
            isAuthenticated: true,
            trustedDevice: true,
            mfaRequired: false,
            user: { id: 'u1', email: 'a@b.com', displayName: 'a', role: 'owner' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }

      return new Response(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    }

    const client = createOpenCtoClient({
      baseUrl: 'https://api.opencto.works',
      fetchImpl,
    })

    const session = await client.auth.getSession()
    expect(session.isAuthenticated).toBe(true)
  })
})
