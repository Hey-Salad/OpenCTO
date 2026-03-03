import { AuthSession } from '@/types/models';
import { ApiClient } from './http';

export const getAuthSession = (client: ApiClient): Promise<AuthSession> => {
  return client.request<AuthSession>('/api/v1/auth/session');
};

export const deleteAccount = (client: ApiClient): Promise<void> => {
  return client.request<void>('/api/v1/auth/account', {
    method: 'DELETE'
  });
};
