import { ChatMessage, ChatSummary } from '@/types/models';
import { ApiClient } from './http';

interface ChatListResponse {
  chats: ChatSummary[];
}

interface ChatResponse {
  messages: ChatMessage[];
}

export const getChats = async (client: ApiClient): Promise<ChatSummary[]> => {
  const response = await client.request<ChatListResponse>('/api/v1/chats');
  return response.chats ?? [];
};

export const getChatById = async (client: ApiClient, chatId: string): Promise<ChatMessage[]> => {
  const response = await client.request<ChatResponse>(`/api/v1/chats/${chatId}`);
  return response.messages ?? [];
};

export const saveChat = (client: ApiClient, payload: { chatId: string; messages: ChatMessage[] }): Promise<void> => {
  return client.request<void>('/api/v1/chats/save', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};
