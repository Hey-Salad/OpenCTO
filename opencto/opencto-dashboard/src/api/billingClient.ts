import type {
  BillingPortalSessionResponse,
  BillingSummaryResponse,
  BillingInterval,
  CheckoutSessionResponse,
  InvoicesResponse,
  PlanCode,
} from '../types/billing'
import { getApiBaseUrl } from '../config/apiBase'
import { getAuthHeaders } from '../lib/authToken'

export interface BillingApi {
  createCheckoutSession: (planCode: PlanCode, interval: BillingInterval) => Promise<CheckoutSessionResponse>
  createBillingPortalSession: () => Promise<BillingPortalSessionResponse>
  getSubscriptionSummary: () => Promise<BillingSummaryResponse>
  getInvoices: () => Promise<InvoicesResponse>
}

const DEFAULT_BILLING_BASE = `${getApiBaseUrl()}/api/v1/billing`

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...getAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(`Billing API request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

export class BillingHttpClient implements BillingApi {
  constructor(private readonly baseUrl = DEFAULT_BILLING_BASE) {}

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

  getSubscriptionSummary(): Promise<BillingSummaryResponse> {
    return fetchJson<BillingSummaryResponse>(`${this.baseUrl}/subscription`)
  }

  getInvoices(): Promise<InvoicesResponse> {
    return fetchJson<InvoicesResponse>(`${this.baseUrl}/invoices`)
  }
}
