export type CodebaseRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'timed_out'
export type CodebaseRunEventLevel = 'system' | 'info' | 'warn' | 'error'

export interface CodebaseRun {
  id: string
  userId: string
  repoUrl: string
  repoFullName: string | null
  baseBranch: string
  targetBranch: string
  status: CodebaseRunStatus
  requestedCommands: string[]
  commandAllowlistVersion: string
  timeoutSeconds: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  canceledAt: string | null
  errorMessage: string | null
}

export interface CodebaseRunEvent {
  id: string
  runId: string
  seq: number
  level: CodebaseRunEventLevel
  eventType: string
  message: string
  payload: Record<string, unknown> | null
  createdAt: string
}

export interface CreateCodebaseRunResponse {
  run: CodebaseRun
  allowlist: string[]
}

export interface GetCodebaseRunResponse {
  run: CodebaseRun
  metrics: {
    eventCount: number
    artifactCount: number
  }
}

export interface GetCodebaseRunEventsResponse {
  runId: string
  events: CodebaseRunEvent[]
  lastSeq: number
  pollAfterMs: number
}
