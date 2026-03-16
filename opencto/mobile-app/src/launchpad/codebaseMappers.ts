import {
  WorkerCodebaseRun,
  WorkerRunEvent,
  WorkerRunStatus
} from '@/api/contracts/codebaseRuns';
import { CodebaseRun, CodebaseRunEvent, RunStatus } from '@/types/models';

const statusMap: Record<WorkerRunStatus, RunStatus> = {
  queued: 'queued',
  running: 'in_progress',
  succeeded: 'completed',
  failed: 'failed',
  canceled: 'canceled',
  timed_out: 'failed'
};

export const normalizeRunStatus = (status: string): RunStatus => {
  const lower = status.toLowerCase() as WorkerRunStatus | RunStatus;
  if (lower in statusMap) {
    return statusMap[lower as WorkerRunStatus];
  }
  if (lower === 'in_progress' || lower === 'completed' || lower === 'queued' || lower === 'failed' || lower === 'canceled') {
    return lower;
  }
  return 'failed';
};

export const mapWorkerRun = (run: WorkerCodebaseRun): CodebaseRun => {
  const title = run.repoFullName?.trim() || run.repoUrl || 'Codebase run';
  const updatedAt = run.completedAt ?? run.canceledAt ?? run.startedAt ?? run.createdAt;

  return {
    id: run.id,
    title,
    status: normalizeRunStatus(run.status),
    createdAt: run.createdAt,
    updatedAt,
    repo: run.repoFullName ?? run.repoUrl,
    branch: run.targetBranch
  };
};

export const mapWorkerRunEvent = (event: WorkerRunEvent): CodebaseRunEvent => {
  return {
    id: event.id,
    runId: event.runId,
    seq: event.seq,
    type: event.eventType,
    message: event.message,
    createdAt: event.createdAt,
    payload: event.payload ?? undefined
  };
};
