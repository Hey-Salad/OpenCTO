import { getApiBaseUrl } from '../config/apiBase'
import { getAuthHeaders } from '../lib/authToken'
import { normalizeApiError, safeFetchJson } from '../lib/safeError'
import type {
  CreateCodebaseRunResponse,
  GetCodebaseRunEventsResponse,
  GetCodebaseRunResponse,
  MutateCodebaseRunResponse,
} from '../types/codebaseRuns'

const API_BASE = `${getApiBaseUrl()}/api/v1/codebase/runs`

export async function createCodebaseRun(payload: {
  repoUrl: string
  repoFullName?: string
  baseBranch?: string
  targetBranch?: string
  commands: string[]
  timeoutSeconds?: number
}): Promise<CreateCodebaseRunResponse> {
  try {
    return await safeFetchJson<CreateCodebaseRunResponse>(
      API_BASE,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      },
      'Failed to create codebase run',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to create codebase run')
  }
}

export async function getCodebaseRun(runId: string): Promise<GetCodebaseRunResponse> {
  try {
    return await safeFetchJson<GetCodebaseRunResponse>(
      `${API_BASE}/${encodeURIComponent(runId)}`,
      { headers: getAuthHeaders() },
      'Failed to load codebase run',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load codebase run')
  }
}

export async function getCodebaseRunEvents(
  runId: string,
  options?: { afterSeq?: number; limit?: number },
): Promise<GetCodebaseRunEventsResponse> {
  const url = new URL(`${API_BASE}/${encodeURIComponent(runId)}/events`)
  if (typeof options?.afterSeq === 'number') url.searchParams.set('afterSeq', String(options.afterSeq))
  if (typeof options?.limit === 'number') url.searchParams.set('limit', String(options.limit))

  try {
    return await safeFetchJson<GetCodebaseRunEventsResponse>(
      url.toString(),
      { headers: getAuthHeaders() },
      'Failed to load run events',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load run events')
  }
}

export async function cancelCodebaseRun(runId: string): Promise<GetCodebaseRunResponse> {
  try {
    return await safeFetchJson<GetCodebaseRunResponse>(
      `${API_BASE}/${encodeURIComponent(runId)}/cancel`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      },
      'Failed to cancel codebase run',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to cancel codebase run')
  }
}

export async function approveCodebaseRun(runId: string, note?: string): Promise<MutateCodebaseRunResponse> {
  try {
    return await safeFetchJson<MutateCodebaseRunResponse>(
      `${API_BASE}/${encodeURIComponent(runId)}/approve`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ note: note ?? '' }),
      },
      'Failed to approve codebase run',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to approve codebase run')
  }
}

export async function denyCodebaseRun(runId: string, note?: string): Promise<MutateCodebaseRunResponse> {
  try {
    return await safeFetchJson<MutateCodebaseRunResponse>(
      `${API_BASE}/${encodeURIComponent(runId)}/deny`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ note: note ?? '' }),
      },
      'Failed to deny codebase run',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to deny codebase run')
  }
}
