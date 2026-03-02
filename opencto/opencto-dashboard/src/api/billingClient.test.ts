import { describe, expect, it, vi, afterEach } from 'vitest'
import { BillingHttpClient } from './billingClient'

describe('BillingHttpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('surfaces structured error details when billing summary fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'upstream down' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const client = new BillingHttpClient('https://api.example.com/api/v1/billing')

    await expect(client.getSubscriptionSummary()).rejects.toMatchObject({
      code: 'UPSTREAM_FAILURE',
      status: 503,
      message: 'Failed to load billing summary (503)',
    })
  })

  it('includes auth and idempotency headers for checkout requests', async () => {
    window.localStorage.setItem('opencto_auth_token', 'token-123')

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ sessionId: 'cs_test', checkoutUrl: 'https://checkout.example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const client = new BillingHttpClient('https://api.example.com/api/v1/billing')
    await client.createCheckoutSession('TEAM', 'MONTHLY')

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-123')
    expect(headers['x-idempotency-key']).toMatch(/^checkout-TEAM-MONTHLY-/)
  })
})
