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
import { normalizeApiError, safeFetchJson } from '../lib/safeError'

export interface BillingApi {
  createCheckoutSession: (planCode: PlanCode, interval: BillingInterval) => Promise<CheckoutSessionResponse>
  createBillingPortalSession: () => Promise<BillingPortalSessionResponse>
  getSubscriptionSummary: () => Promise<BillingSummaryResponse>
  getInvoices: () => Promise<InvoicesResponse>
}

const DEFAULT_BILLING_BASE = `${getApiBaseUrl()}/api/v1/billing`

async function fetchJson<T>(input: RequestInfo | URL, init: RequestInit | undefined, fallbackMessage: string): Promise<T> {
  try {
    return await safeFetchJson<T>(input, {
      ...init,
      headers: {
        ...getAuthHeaders(),
        ...(init?.headers ?? {}),
      },
    }, fallbackMessage)
  } catch (error) {
    throw normalizeApiError(error, fallbackMessage)
  }
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
    }, 'Failed to create checkout session')
  }

  createBillingPortalSession(): Promise<BillingPortalSessionResponse> {
    return fetchJson<BillingPortalSessionResponse>(`${this.baseUrl}/portal/session`, {
      method: 'POST',
      headers: {
        'x-idempotency-key': `portal-${Date.now()}`,
      },
    }, 'Failed to create billing portal session')
  }

  getSubscriptionSummary(): Promise<BillingSummaryResponse> {
    return fetchJson<BillingSummaryResponse>(`${this.baseUrl}/subscription`, undefined, 'Failed to load billing summary')
  }

  getInvoices(): Promise<InvoicesResponse> {
    return fetchJson<InvoicesResponse>(`${this.baseUrl}/invoices`, undefined, 'Failed to load invoices')
  }
}
