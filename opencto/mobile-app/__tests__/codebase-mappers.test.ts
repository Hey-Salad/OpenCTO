import { describe, expect, it } from 'vitest';
import { mapWorkerRun, mapWorkerRunEvent, normalizeRunStatus } from '@/launchpad/codebaseMappers';

describe('codebaseMappers', () => {
  it('normalizes worker statuses to mobile statuses', () => {
    expect(normalizeRunStatus('running')).toBe('in_progress');
    expect(normalizeRunStatus('succeeded')).toBe('completed');
    expect(normalizeRunStatus('timed_out')).toBe('failed');
  });

  it('maps worker run shape', () => {
    const mapped = mapWorkerRun({
      id: 'run_1',
      userId: 'user_1',
      repoUrl: 'https://github.com/org/repo',
      repoFullName: 'org/repo',
      baseBranch: 'main',
      targetBranch: 'opencto/mobile-123',
      status: 'running',
      requestedCommands: ['npm run build'],
      commandAllowlistVersion: '2026-03-02',
      timeoutSeconds: 600,
      createdAt: '2026-03-03T00:00:00.000Z',
      startedAt: '2026-03-03T00:01:00.000Z',
      completedAt: null,
      canceledAt: null,
      errorMessage: null
    });

    expect(mapped.title).toBe('org/repo');
    expect(mapped.status).toBe('in_progress');
    expect(mapped.branch).toBe('opencto/mobile-123');
  });

  it('maps worker run event shape', () => {
    const mapped = mapWorkerRunEvent({
      id: 'evt_1',
      runId: 'run_1',
      seq: 12,
      level: 'info',
      eventType: 'run.plan',
      message: 'Planning',
      payload: { phase: 'plan' },
      createdAt: '2026-03-03T00:00:00.000Z'
    });

    expect(mapped.type).toBe('run.plan');
    expect(mapped.seq).toBe(12);
    expect(mapped.payload?.phase).toBe('plan');
  });
});
