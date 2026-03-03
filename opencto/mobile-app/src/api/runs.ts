import { CodebaseRun, CodebaseRunEvent } from '@/types/models';
import { ApiClient } from './http';

interface RunsResponse {
  runs: CodebaseRun[];
}

interface RunResponse {
  run: CodebaseRun;
}

interface RunEventsResponse {
  events: CodebaseRunEvent[];
}

export const createRun = (client: ApiClient, payload: { prompt: string }): Promise<CodebaseRun> => {
  return client.request<CodebaseRun>('/api/v1/codebase/runs', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

export const getRuns = async (client: ApiClient): Promise<CodebaseRun[]> => {
  const response = await client.request<RunsResponse>('/api/v1/codebase/runs');
  return response.runs ?? [];
};

export const getRunById = async (client: ApiClient, runId: string): Promise<CodebaseRun> => {
  const response = await client.request<RunResponse>(`/api/v1/codebase/runs/${runId}`);
  return response.run;
};

export const getRunEvents = async (client: ApiClient, runId: string): Promise<CodebaseRunEvent[]> => {
  const response = await client.request<RunEventsResponse>(`/api/v1/codebase/runs/${runId}/events`, { retries: 1 });
  return response.events ?? [];
};

export const cancelRun = (client: ApiClient, runId: string): Promise<void> => {
  return client.request<void>(`/api/v1/codebase/runs/${runId}/cancel`, {
    method: 'POST'
  });
};

export const getRunEventsStreamUrl = (runId: string): string => {
  return `/api/v1/codebase/runs/${runId}/events/stream`;
};
