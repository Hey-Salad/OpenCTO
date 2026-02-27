import type {
  BillingPortalSessionResponse,
  BillingSummaryResponse,
  BillingInterval,
  CheckoutSessionResponse,
  InvoicesResponse,
  PlanCode,
} from '../types/billing'

export interface BillingApi {
  createCheckoutSession: (planCode: PlanCode, interval: BillingInterval) => Promise<CheckoutSessionResponse>
  createBillingPortalSession: () => Promise<BillingPortalSessionResponse>
  fetchSubscriptionSummary: () => Promise<BillingSummaryResponse>
  fetchInvoices: () => Promise<InvoicesResponse>
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(`Billing API request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

export class BillingHttpClient implements BillingApi {
  constructor(private readonly baseUrl = 'https://api.opencto.works/api/v1/billing') {}

  createCheckoutSession(planCode: PlanCode, interval: BillingInterval): Promise<CheckoutSessionResponse> {
    return fetchJson<CheckoutSessionResponse>(`${this.baseUrl}/checkout/session`, {
      method: 'POST',
      body: JSON.stringify({ planCode, interval }),
      headers: {
        'x-idempotency-key': `checkout-${planCode}-${interval}-${Date.now()}`,
      },
    })
  }

  createBillingPortalSession(): Promise<BillingPortalSessionResponse> {
    return fetchJson<BillingPortalSessionResponse>(`${this.baseUrl}/portal/session`, {
      method: 'POST',
      headers: {
        'x-idempotency-key': `portal-${Date.now()}`,
      },
    })
  }

  fetchSubscriptionSummary(): Promise<BillingSummaryResponse> {
    return fetchJson<BillingSummaryResponse>(`${this.baseUrl}/subscription`)
  }

  fetchInvoices(): Promise<InvoicesResponse> {
    return fetchJson<InvoicesResponse>(`${this.baseUrl}/invoices`)
  }
}
