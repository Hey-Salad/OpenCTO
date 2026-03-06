export type CodebaseRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'timed_out'
export type CodebaseRunEventLevel = 'system' | 'info' | 'warn' | 'error'
export type CodebaseRunApprovalState = 'not_required' | 'pending' | 'approved' | 'denied'

export interface CodebaseRunApproval {
  required: boolean
  state: CodebaseRunApprovalState
  reason: string | null
  approvedByUserId: string | null
  decidedAt: string | null
}

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
  approval?: CodebaseRunApproval
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

export interface MutateCodebaseRunResponse {
  run: CodebaseRun
}

export interface GetCodebaseRunEventsResponse {
  runId: string
  events: CodebaseRunEvent[]
  lastSeq: number
  pollAfterMs: number
}

export interface CodebaseMetrics {
  window: string
  since: string
  totals: {
    totalRuns: number
    succeededRuns: number
    failedRuns: number
    activeRuns: number
    avgDurationSeconds: number
  }
}

export interface CodebaseRunArtifact {
  id: string
  runId: string
  kind: string
  path: string
  sizeBytes?: number | null
  sha256?: string | null
  url?: string | null
  expiresAt?: string | null
  createdAt: string
}

export interface ListCodebaseRunArtifactsResponse {
  artifacts: CodebaseRunArtifact[]
}
