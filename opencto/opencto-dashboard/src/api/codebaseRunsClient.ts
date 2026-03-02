import { getApiBaseUrl } from '../config/apiBase'
import { getAuthHeaders } from '../lib/authToken'
import { normalizeApiError, safeFetchJson } from '../lib/safeError'
import type {
  CodebaseMetrics,
  CreateCodebaseRunResponse,
  GetCodebaseRunEventsResponse,
  GetCodebaseRunResponse,
  ListCodebaseRunArtifactsResponse,
} from '../types/codebaseRuns'

const API_BASE = `${getApiBaseUrl()}/api/v1/codebase`

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
      `${API_BASE}/runs`,
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
      `${API_BASE}/runs/${encodeURIComponent(runId)}`,
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
  const url = new URL(`${API_BASE}/runs/${encodeURIComponent(runId)}/events`)
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
      `${API_BASE}/runs/${encodeURIComponent(runId)}/cancel`,
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

export async function getCodebaseMetrics(): Promise<CodebaseMetrics> {
  try {
    return await safeFetchJson<CodebaseMetrics>(
      `${API_BASE}/metrics`,
      { headers: getAuthHeaders() },
      'Failed to load codebase metrics',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load codebase metrics')
  }
}

export async function listCodebaseRunArtifacts(runId: string): Promise<ListCodebaseRunArtifactsResponse> {
  try {
    return await safeFetchJson<ListCodebaseRunArtifactsResponse>(
      `${API_BASE}/runs/${encodeURIComponent(runId)}/artifacts`,
      { headers: getAuthHeaders() },
      'Failed to load run artifacts',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load run artifacts')
  }
}

export function getCodebaseRunArtifactDownloadUrl(runId: string, artifactId: string): string {
  return `${API_BASE}/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactId)}`
}

export function streamCodebaseRunEvents(
  runId: string,
  options: {
    afterSeq?: number
    onEvents: (events: GetCodebaseRunEventsResponse['events'], lastSeq: number) => void
    onRun: (run: GetCodebaseRunResponse['run']) => void
    onError: (message: string) => void
    signal: AbortSignal
  },
): Promise<void> {
  const url = new URL(`${API_BASE}/runs/${encodeURIComponent(runId)}/events/stream`)
  if (typeof options.afterSeq === 'number') url.searchParams.set('afterSeq', String(options.afterSeq))

  return fetch(url.toString(), {
    headers: {
      ...getAuthHeaders(),
      Accept: 'text/event-stream',
    },
    signal: options.signal,
  })
    .then(async (response) => {
      if (!response.ok || !response.body) {
        throw new Error(`Failed to stream run events (${response.status})`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''
      let currentData = ''

      const flush = () => {
        if (!currentEvent || !currentData) return
        try {
          const payload = JSON.parse(currentData) as Record<string, unknown>
          if (currentEvent === 'events' && Array.isArray(payload.events)) {
            options.onEvents(payload.events as GetCodebaseRunEventsResponse['events'], Number(payload.lastSeq ?? 0))
          } else if (currentEvent === 'run' && payload.run && typeof payload.run === 'object') {
            options.onRun(payload.run as GetCodebaseRunResponse['run'])
          } else if (currentEvent === 'error') {
            options.onError(String(payload.message ?? 'Stream error'))
          }
        } catch {
          options.onError('Malformed SSE payload')
        } finally {
          currentEvent = ''
          currentData = ''
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const rawLine of lines) {
          const line = rawLine.trimEnd()
          if (!line) {
            flush()
            continue
          }
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            const part = line.slice(5).trim()
            currentData = currentData ? `${currentData}\n${part}` : part
          }
        }
      }
    })
}
