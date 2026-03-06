export type ChatMessageRole = 'USER' | 'ASSISTANT' | 'TOOL'
export type ChatMessageKind = 'speech' | 'code' | 'command' | 'output' | 'artifact' | 'plan'

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  kind?: ChatMessageKind
  text: string
  timestamp: string
  startMs: number
  endMs: number
  metadata?: Record<string, unknown>
}

export interface ChatSummary {
  id: string
  title: string
  updatedAt: string
  createdAt?: string
}

export interface ChatRecord {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: string
  createdAt: string
}

export interface SaveChatPayload {
  id?: string
  title?: string
  messages: ChatMessage[]
}
