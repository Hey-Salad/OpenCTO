import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/http';
import { streamRunEvents } from '@/api/runs';

describe('streamRunEvents', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses SSE events and maps payloads', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'event: events\n',
      'data: {"runId":"run_1","lastSeq":2,"events":[{"id":"evt_1","runId":"run_1","seq":1,"level":"info","eventType":"run.plan","message":"[plan] Draft plan","payload":null,"createdAt":"2026-03-03T00:00:00.000Z"},{"id":"evt_2","runId":"run_1","seq":2,"level":"info","eventType":"run.command","message":"[cmd] npm run build","payload":{"command":"npm run build"},"createdAt":"2026-03-03T00:00:01.000Z"}]}\n\n',
      'event: run\n',
      'data: {"run":{"id":"run_1","userId":"u","repoUrl":"https://github.com/org/repo","repoFullName":"org/repo","baseBranch":"main","targetBranch":"opencto/mobile","status":"running","requestedCommands":["npm run build"],"commandAllowlistVersion":"2026-03-02","timeoutSeconds":600,"createdAt":"2026-03-03T00:00:00.000Z"}}\n\n'
    ];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      }
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient(async () => 'token_123');
    const events: string[] = [];
    const runs: string[] = [];

    await streamRunEvents(client, 'run_1', {
      signal: new AbortController().signal,
      onEvents: (items) => {
        events.push(...items.map((item) => item.type));
      },
      onRun: (run) => {
        runs.push(run.status);
      }
    });

    expect(events).toEqual(['run.plan', 'run.command']);
    expect(runs).toEqual(['in_progress']);

    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit)?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token_123');
  });
});
