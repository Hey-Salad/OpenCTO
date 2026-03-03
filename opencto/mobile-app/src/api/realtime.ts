import { RealtimeTokenPayload } from '@/types/models';
import { ApiClient } from './http';

export const getRealtimeToken = async (client: ApiClient, workspaceId?: string): Promise<RealtimeTokenPayload> => {
  const raw = await client.request<{
    token?: string;
    clientSecret?: string;
    websocketUrl?: string;
    model?: string;
    expiresAt?: number;
  }>('/api/v1/realtime/token', {
    method: 'POST',
    body: JSON.stringify({ workspaceId })
  });

  return {
    token: raw.token ?? raw.clientSecret ?? '',
    websocketUrl: raw.websocketUrl,
    model: raw.model,
    expiresAt: raw.expiresAt
  };
};
