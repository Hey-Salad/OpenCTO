import { getApiBaseUrl } from '../config/apiBase'
import { getAuthHeaders } from '../lib/authToken'
import { normalizeApiError, safeFetchJson } from '../lib/safeError'
import type { OnboardingState, SaveOnboardingInput } from '../types/onboarding'

const API_BASE = `${getApiBaseUrl()}/api/v1`

export async function getOnboardingState(): Promise<OnboardingState> {
  try {
    return await safeFetchJson<OnboardingState>(
      `${API_BASE}/onboarding`,
      { headers: getAuthHeaders() },
      'Failed to load onboarding state',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load onboarding state')
  }
}

export async function saveOnboardingState(input: SaveOnboardingInput): Promise<OnboardingState> {
  try {
    return await safeFetchJson<OnboardingState>(
      `${API_BASE}/onboarding`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      },
      'Failed to save onboarding data',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to save onboarding data')
  }
}
