import { getApiBaseUrl } from '../config/apiBase'
import { getAuthHeaders } from '../lib/authToken'
import { normalizeApiError, safeFetchJson } from '../lib/safeError'

const BASE = `${getApiBaseUrl()}/api/v1/llm/keys`

export interface ProviderKeySummary {
  provider: string
  workspaceId: string
  keyHint: string
  createdAt: string
  updatedAt: string
}

export async function listProviderKeys(workspaceId: string): Promise<ProviderKeySummary[]> {
  try {
    const response = await safeFetchJson<{ keys: ProviderKeySummary[] }>(
      `${BASE}?workspaceId=${encodeURIComponent(workspaceId)}`,
      { headers: getAuthHeaders() },
      'Failed to load provider keys',
    )
    return response.keys ?? []
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load provider keys')
  }
}

export async function saveProviderKey(provider: string, apiKey: string, workspaceId: string): Promise<void> {
  try {
    await safeFetchJson(
      `${BASE}/${encodeURIComponent(provider)}`,
      {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'x-idempotency-key': `byok-${provider}-${Date.now()}`,
        },
        body: JSON.stringify({ apiKey, workspaceId }),
      },
      `Failed to save ${provider} key`,
    )
  } catch (error) {
    throw normalizeApiError(error, `Failed to save ${provider} key`)
  }
}

export async function deleteProviderKey(provider: string, workspaceId: string): Promise<void> {
  try {
    await safeFetchJson(
      `${BASE}/${encodeURIComponent(provider)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
          'x-idempotency-key': `byok-delete-${provider}-${Date.now()}`,
        },
      },
      `Failed to delete ${provider} key`,
    )
  } catch (error) {
    throw normalizeApiError(error, `Failed to delete ${provider} key`)
  }
}
