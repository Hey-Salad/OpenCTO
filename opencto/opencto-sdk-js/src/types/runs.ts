export type CodebaseRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'timed_out'

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
  level: 'system' | 'info' | 'warn' | 'error'
  eventType: string
  message: string
  payload: Record<string, unknown> | null
  createdAt: string
}

export interface CodebaseRunArtifact {
  id: string
  runId: string
  kind: string
  path: string
  sizeBytes: number | null
  sha256: string | null
  url: string | null
  expiresAt: string | null
  createdAt: string
}

export interface CreateCodebaseRunPayload {
  repoUrl: string
  repoFullName?: string
  baseBranch?: string
  targetBranch?: string
  commands: string[]
  timeoutSeconds?: number
}

export interface GetCodebaseRunResponse {
  run: CodebaseRun
  metrics?: {
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

export interface ListCodebaseRunArtifactsResponse {
  runId: string
  artifacts: CodebaseRunArtifact[]
}
