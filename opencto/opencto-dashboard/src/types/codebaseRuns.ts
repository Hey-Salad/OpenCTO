export type CodebaseExecutionMode = 'stub' | 'container'

export type CodebaseRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'timed_out'

export interface CodebaseRun {
  id: string
  userId?: string
  repoUrl: string
  requestedCommands: string[]
  status: CodebaseRunStatus
  executionMode: CodebaseExecutionMode
  timeoutSeconds?: number
  createdAt: string
  updatedAt: string
  startedAt?: string | null
  completedAt?: string | null
  errorMessage?: string | null
}

export interface CodebaseRunEvent {
  runId: string
  seq: number
  type: string
  message: string
  timestamp: string
  metadata?: Record<string, unknown> | null
}

export interface CodebaseRunCreateResponse {
  run: CodebaseRun
}

export interface CodebaseRunResponse {
  run: CodebaseRun
}

export interface CodebaseRunEventsResponse {
  events: CodebaseRunEvent[]
  nextAfterSeq: number
}
