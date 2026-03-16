import { describe, expect, it } from 'vitest';
import { normalizeRunEvent } from '@/launchpad/eventNormalizer';

describe('normalizeRunEvent', () => {
  it('maps plan events from type', () => {
    const normalized = normalizeRunEvent({
      id: 'evt_1',
      runId: 'run_1',
      type: 'run.plan.updated',
      message: 'Refactor auth flow',
      createdAt: new Date().toISOString()
    });

    expect(normalized.kind).toBe('plan');
    expect(normalized.content).toBe('Refactor auth flow');
    expect(normalized.metadata.title).toBe('Run Plan Updated');
  });

  it('maps command events from tag prefix', () => {
    const normalized = normalizeRunEvent({
      id: 'evt_2',
      runId: 'run_1',
      type: 'run.event',
      message: '[cmd] npm run build',
      createdAt: new Date().toISOString()
    });

    expect(normalized.kind).toBe('command');
    expect(normalized.content).toBe('npm run build');
  });

  it('reads structured payload metadata', () => {
    const normalized = normalizeRunEvent({
      id: 'evt_3',
      runId: 'run_2',
      type: 'artifact.code',
      message: '{"message":"[code] const x = 1;","language":"typescript","source":"repo"}',
      createdAt: new Date().toISOString()
    });

    expect(normalized.kind).toBe('code');
    expect(normalized.content).toBe('const x = 1;');
    expect(normalized.metadata.language).toBe('typescript');
    expect(normalized.metadata.source).toBe('repo');
  });
});
