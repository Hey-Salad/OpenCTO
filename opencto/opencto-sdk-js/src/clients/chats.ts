import type { ChatRecord, ChatSummary, SaveChatPayload } from '../types/chats.js'
import type { HttpClientOptions } from '../core/http.js'
import { createHttpClient } from '../core/http.js'

export interface ChatsClient {
  list(): Promise<ChatSummary[]>
  get(chatId: string): Promise<ChatRecord>
  save(payload: SaveChatPayload): Promise<ChatRecord>
}

export function createChatsClient(options: HttpClientOptions): ChatsClient {
  const http = createHttpClient(options)

  return {
    async list() {
      const response = await http.get<{ chats?: ChatSummary[] }>('/api/v1/chats', 'Failed to list chats')
      return response.chats ?? []
    },

    get(chatId: string) {
      return http.get<ChatRecord>(`/api/v1/chats/${encodeURIComponent(chatId)}`, 'Failed to load chat')
    },

    save(payload: SaveChatPayload) {
      return http.post<ChatRecord>('/api/v1/chats/save', payload, 'Failed to save chat')
    },
  }
}
