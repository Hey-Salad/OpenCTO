import type {
  CreateCodebaseRunPayload,
  GetCodebaseRunResponse,
  GetCodebaseRunEventsResponse,
  ListCodebaseRunArtifactsResponse,
} from '../types/runs.js'
import type { HttpClientOptions } from '../core/http.js'
import { createHttpClient } from '../core/http.js'

export interface RunsClient {
  create(payload: CreateCodebaseRunPayload): Promise<GetCodebaseRunResponse>
  get(runId: string): Promise<GetCodebaseRunResponse>
  events(runId: string, options?: { afterSeq?: number; limit?: number }): Promise<GetCodebaseRunEventsResponse>
  cancel(runId: string): Promise<GetCodebaseRunResponse>
  artifacts(runId: string): Promise<ListCodebaseRunArtifactsResponse>
  artifactUrl(runId: string, artifactId: string): string
}

export function createRunsClient(options: HttpClientOptions): RunsClient {
  const http = createHttpClient(options)
  const baseUrl = options.baseUrl.replace(/\/+$/, '')

  return {
    create(payload: CreateCodebaseRunPayload) {
      return http.post<GetCodebaseRunResponse>('/api/v1/codebase/runs', payload, 'Failed to create codebase run')
    },

    get(runId: string) {
      return http.get<GetCodebaseRunResponse>(`/api/v1/codebase/runs/${encodeURIComponent(runId)}`, 'Failed to load codebase run')
    },

    events(runId: string, optionsArg?: { afterSeq?: number; limit?: number }) {
      const params = new URLSearchParams()
      if (typeof optionsArg?.afterSeq === 'number') params.set('afterSeq', String(optionsArg.afterSeq))
      if (typeof optionsArg?.limit === 'number') params.set('limit', String(optionsArg.limit))
      const query = params.toString() ? `?${params.toString()}` : ''
      return http.get<GetCodebaseRunEventsResponse>(
        `/api/v1/codebase/runs/${encodeURIComponent(runId)}/events${query}`,
        'Failed to load codebase run events',
      )
    },

    cancel(runId: string) {
      return http.post<GetCodebaseRunResponse>(
        `/api/v1/codebase/runs/${encodeURIComponent(runId)}/cancel`,
        undefined,
        'Failed to cancel codebase run',
      )
    },

    artifacts(runId: string) {
      return http.get<ListCodebaseRunArtifactsResponse>(
        `/api/v1/codebase/runs/${encodeURIComponent(runId)}/artifacts`,
        'Failed to list run artifacts',
      )
    },

    artifactUrl(runId: string, artifactId: string) {
      return `${baseUrl}/api/v1/codebase/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactId)}`
    },
  }
}
