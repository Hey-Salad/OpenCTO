export type WorkerRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'timed_out';
export type WorkerRunApprovalState = 'not_required' | 'pending' | 'approved' | 'denied';

export interface WorkerRunApproval {
  required: boolean;
  state: WorkerRunApprovalState;
  reason?: string | null;
  approvedByUserId?: string | null;
  decidedAt?: string | null;
}

export interface WorkerCodebaseRun {
  id: string;
  userId: string;
  repoUrl: string;
  repoFullName?: string | null;
  baseBranch: string;
  targetBranch: string;
  status: WorkerRunStatus;
  requestedCommands: string[];
  commandAllowlistVersion: string;
  timeoutSeconds: number;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  canceledAt?: string | null;
  errorMessage?: string | null;
  approval?: WorkerRunApproval;
}

export interface WorkerRunEvent {
  id: string;
  runId: string;
  seq: number;
  level: 'system' | 'info' | 'warn' | 'error';
  eventType: string;
  message: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface WorkerCreateRunResponse {
  run: WorkerCodebaseRun;
  allowlist?: string[];
}

export interface WorkerGetRunResponse {
  run: WorkerCodebaseRun;
}

export interface WorkerListRunsResponse {
  runs: WorkerCodebaseRun[];
  nextOffset?: number | null;
}

export interface WorkerGetRunEventsResponse {
  runId: string;
  events: WorkerRunEvent[];
  lastSeq: number;
  pollAfterMs?: number;
}

export interface WorkerCancelRunResponse {
  run: WorkerCodebaseRun;
}

export interface WorkerApproveRunResponse {
  run: WorkerCodebaseRun;
}

export interface WorkerDenyRunResponse {
  run: WorkerCodebaseRun;
}

export interface WorkerCreateRunPayload {
  repoUrl: string;
  repoFullName?: string;
  baseBranch?: string;
  targetBranch?: string;
  commands: string[];
  timeoutSeconds?: number;
}
