import { normalizeApiError, safeFetchJson } from '../lib/safeError'
import { getAuthHeaders } from '../lib/authToken'
import { getApiBaseUrl } from '../config/apiBase'
import type { AudioMessage } from '../components/audio/AudioRealtimeView'

const API_BASE = `${getApiBaseUrl()}/api/v1`

export interface SavedChatSummary {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface SavedChat {
  id: string
  userId: string
  title: string
  messages: AudioMessage[]
  createdAt: string
  updatedAt: string
}

export async function listSavedChats(): Promise<SavedChatSummary[]> {
  try {
    return await safeFetchJson<SavedChatSummary[]>(
      `${API_BASE}/chats`,
      { headers: getAuthHeaders() },
      'Failed to load chats',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load chats')
  }
}

export async function getSavedChat(chatId: string): Promise<SavedChat> {
  try {
    return await safeFetchJson<SavedChat>(
      `${API_BASE}/chats/${encodeURIComponent(chatId)}`,
      { headers: getAuthHeaders() },
      'Failed to load chat',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load chat')
  }
}

export async function saveChatSnapshot(input: {
  id?: string
  title?: string
  messages: AudioMessage[]
}): Promise<SavedChat> {
  try {
    return await safeFetchJson<SavedChat>(
      `${API_BASE}/chats/save`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      },
      'Failed to save chat',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to save chat')
  }
}
