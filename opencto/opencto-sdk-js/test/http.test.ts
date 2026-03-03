import { describe, expect, it } from 'vitest'
import { createHttpClient } from '../src/core/http'

describe('http client', () => {
  it('injects bearer token and returns JSON', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init })
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const http = createHttpClient({
      baseUrl: 'https://api.opencto.works',
      getToken: () => 'abc123',
      fetchImpl,
    })

    const result = await http.get<{ ok: boolean }>('/health')
    expect(result.ok).toBe(true)
    expect(String(calls[0]?.input)).toBe('https://api.opencto.works/health')

    const headers = new Headers(calls[0]?.init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer abc123')
  })

  it('throws normalized error on non-2xx', async () => {
    const fetchImpl = async (): Promise<Response> => new Response(
      JSON.stringify({ error: 'nope', code: 'BAD_REQUEST' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )

    const http = createHttpClient({
      baseUrl: 'https://api.opencto.works',
      fetchImpl,
    })

    await expect(http.get('/health', 'fallback')).rejects.toMatchObject({
      message: 'nope',
      code: 'BAD_REQUEST',
      status: 400,
    })
  })
})
