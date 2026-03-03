import { ApiClient, GetToken } from './http';
import * as authApi from './auth';
import * as chatApi from './chats';
import * as runsApi from './runs';
import * as realtimeApi from './realtime';

export interface ApiModules {
  client: ApiClient;
  auth: typeof authApi;
  chat: typeof chatApi;
  runs: typeof runsApi;
  realtime: typeof realtimeApi;
}

export const createApiModules = (getToken: GetToken): ApiModules => {
  const client = new ApiClient(getToken);
  return {
    client,
    auth: authApi,
    chat: chatApi,
    runs: runsApi,
    realtime: realtimeApi
  };
};
