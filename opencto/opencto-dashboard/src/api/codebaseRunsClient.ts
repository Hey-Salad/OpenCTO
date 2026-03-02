import { getApiBaseUrl } from '../config/apiBase'
import { getAuthHeaders } from '../lib/authToken'
import { normalizeApiError, safeFetchJson } from '../lib/safeError'
import type {
  CodebaseRunCreateResponse,
  CodebaseRunEventsResponse,
  CodebaseRunResponse,
} from '../types/codebaseRuns'

const API_BASE = `${getApiBaseUrl()}/api/v1`

export interface CreateCodebaseRunInput {
  repoUrl: string
  commands: string[]
  executionMode?: 'stub' | 'container'
  timeoutSeconds?: number
}

export async function createCodebaseRun(input: CreateCodebaseRunInput): Promise<CodebaseRunCreateResponse> {
  try {
    return await safeFetchJson<CodebaseRunCreateResponse>(
      `${API_BASE}/codebase/runs`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      },
      'Failed to create codebase run',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to create codebase run')
  }
}

export async function getCodebaseRun(runId: string): Promise<CodebaseRunResponse> {
  try {
    return await safeFetchJson<CodebaseRunResponse>(
      `${API_BASE}/codebase/runs/${encodeURIComponent(runId)}`,
      { headers: getAuthHeaders() },
      'Failed to load codebase run',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load codebase run')
  }
}

export async function getCodebaseRunEvents(runId: string, afterSeq = 0, limit = 100): Promise<CodebaseRunEventsResponse> {
  const url = new URL(`${API_BASE}/codebase/runs/${encodeURIComponent(runId)}/events`)
  url.searchParams.set('afterSeq', String(afterSeq))
  url.searchParams.set('limit', String(limit))

  try {
    return await safeFetchJson<CodebaseRunEventsResponse>(
      url.toString(),
      { headers: getAuthHeaders() },
      'Failed to load codebase run events',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load codebase run events')
  }
}

export async function cancelCodebaseRun(runId: string): Promise<CodebaseRunResponse> {
  try {
    return await safeFetchJson<CodebaseRunResponse>(
      `${API_BASE}/codebase/runs/${encodeURIComponent(runId)}/cancel`,
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
