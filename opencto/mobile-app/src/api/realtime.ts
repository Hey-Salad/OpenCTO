import { RealtimeTokenPayload } from '@/types/models';
import { ApiClient } from './http';

export const getRealtimeToken = (client: ApiClient): Promise<RealtimeTokenPayload> => {
  return client.request<RealtimeTokenPayload>('/api/v1/realtime/token', {
    method: 'POST'
  });
};
