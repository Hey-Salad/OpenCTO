import { API_BASE_URL } from '@/config/env';
import {
  WorkerCancelRunResponse,
  WorkerCreateRunPayload,
  WorkerCreateRunResponse,
  WorkerGetRunEventsResponse,
  WorkerGetRunResponse,
  WorkerListRunsResponse
} from '@/api/contracts/codebaseRuns';
import { mapWorkerRun, mapWorkerRunEvent } from '@/launchpad/codebaseMappers';
import { CodebaseRun, CodebaseRunEvent } from '@/types/models';
import { ApiClient } from './http';

interface RunEventStreamOptions {
  afterSeq?: number;
  signal: AbortSignal;
  onEvents: (events: CodebaseRunEvent[], lastSeq: number) => void;
  onRun?: (run: CodebaseRun) => void;
  onError?: (message: string) => void;
}

export const createRun = async (client: ApiClient, payload: WorkerCreateRunPayload): Promise<CodebaseRun> => {
  const response = await client.request<WorkerCreateRunResponse>('/api/v1/codebase/runs', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return mapWorkerRun(response.run);
};

export const getRuns = async (client: ApiClient): Promise<CodebaseRun[]> => {
  const response = await client.request<WorkerListRunsResponse>('/api/v1/codebase/runs');
  return (response.runs ?? []).map(mapWorkerRun);
};

export const getRunById = async (client: ApiClient, runId: string): Promise<CodebaseRun> => {
  const response = await client.request<WorkerGetRunResponse>(`/api/v1/codebase/runs/${runId}`);
  return mapWorkerRun(response.run);
};

export const getRunEvents = async (client: ApiClient, runId: string): Promise<CodebaseRunEvent[]> => {
  const response = await client.request<WorkerGetRunEventsResponse>(`/api/v1/codebase/runs/${runId}/events`, { retries: 1 });
  return (response.events ?? []).map(mapWorkerRunEvent);
};

export const cancelRun = async (client: ApiClient, runId: string): Promise<CodebaseRun> => {
  const response = await client.request<WorkerCancelRunResponse>(`/api/v1/codebase/runs/${runId}/cancel`, {
    method: 'POST'
  });
  return mapWorkerRun(response.run);
};

export const getRunEventsStreamUrl = (runId: string): string => {
  return `/api/v1/codebase/runs/${runId}/events/stream`;
};

export const streamRunEvents = async (
  client: ApiClient,
  runId: string,
  options: RunEventStreamOptions
): Promise<void> => {
  const url = new URL(`${API_BASE_URL}${getRunEventsStreamUrl(runId)}`);
  if (typeof options.afterSeq === 'number') {
    url.searchParams.set('afterSeq', String(options.afterSeq));
  }

  const headers = await client.createAuthHeaders({ Accept: 'text/event-stream' });
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
    signal: options.signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to stream run events (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';
  let currentData = '';

  const flush = () => {
    if (!currentEvent || !currentData) {
      return;
    }
    try {
      const payload = JSON.parse(currentData) as Record<string, unknown>;
      if (currentEvent === 'events' && Array.isArray(payload.events)) {
        const mapped = (payload.events as WorkerGetRunEventsResponse['events']).map(mapWorkerRunEvent);
        options.onEvents(mapped, Number(payload.lastSeq ?? 0));
      } else if (currentEvent === 'run' && payload.run && typeof payload.run === 'object' && options.onRun) {
        options.onRun(mapWorkerRun(payload.run as WorkerGetRunResponse['run']));
      } else if (currentEvent === 'error' && options.onError) {
        options.onError(String(payload.message ?? 'Stream error'));
      }
    } catch {
      if (options.onError) {
        options.onError('Malformed SSE payload');
      }
    } finally {
      currentEvent = '';
      currentData = '';
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line) {
        flush();
        continue;
      }
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const part = line.slice(5).trim();
        currentData = currentData ? `${currentData}\n${part}` : part;
      }
    }
  }
};
