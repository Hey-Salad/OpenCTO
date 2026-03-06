import { getApiBaseUrl } from '../config/apiBase'
import { getAuthHeaders } from '../lib/authToken'
import { normalizeApiError, safeFetchJson } from '../lib/safeError'
import type {
  ConnectedAccountOnboardingLinkResponse,
  ConnectedAccountResponse,
  CreateRentalCheckoutSessionResponse,
  ListMyRentalsResponse,
} from '../types/marketplace'

const API_BASE = `${getApiBaseUrl()}/api/v1/marketplace`

export async function createConnectedAccount(payload: {
  businessName?: string
  country?: string
}): Promise<ConnectedAccountResponse> {
  try {
    return await safeFetchJson<ConnectedAccountResponse>(
      `${API_BASE}/connect/accounts`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      },
      'Failed to create connected account',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to create connected account')
  }
}

export async function createConnectedAccountOnboardingLink(
  accountId: string,
): Promise<ConnectedAccountOnboardingLinkResponse> {
  try {
    return await safeFetchJson<ConnectedAccountOnboardingLinkResponse>(
      `${API_BASE}/connect/accounts/${encodeURIComponent(accountId)}/onboarding-link`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      },
      'Failed to create onboarding link',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to create onboarding link')
  }
}

export async function createRentalCheckoutSession(payload: {
  providerWorkspaceId: string
  providerStripeAccountId: string
  agentSlug: string
  description?: string
  amountUsd: number
  currency?: string
  platformFeePercent?: number
}): Promise<CreateRentalCheckoutSessionResponse> {
  try {
    return await safeFetchJson<CreateRentalCheckoutSessionResponse>(
      `${API_BASE}/agent-rentals/checkout/session`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      },
      'Failed to create rental checkout session',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to create rental checkout session')
  }
}

export async function listMyRentals(): Promise<ListMyRentalsResponse> {
  try {
    return await safeFetchJson<ListMyRentalsResponse>(
      `${API_BASE}/agent-rentals`,
      {
        headers: getAuthHeaders(),
      },
      'Failed to load rental contracts',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load rental contracts')
  }
}
