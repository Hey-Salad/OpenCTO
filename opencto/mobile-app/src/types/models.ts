export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVER'
  | 'UNKNOWN';

export type RealtimeConnectionState =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'error'
  | 'ended';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  status?: number;
  retriable: boolean;
}

export interface AuthSession {
  userId: string;
  email?: string;
  name?: string;
  workspaceId?: string;
  workspaceName?: string;
}

export type ChatRole = 'USER' | 'ASSISTANT' | 'TOOL';
export type LaunchpadMessageKind = 'speech' | 'code' | 'command' | 'output' | 'artifact' | 'plan';

export interface ChatMessage {
  id: string;
  chatId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  kind?: LaunchpadMessageKind;
  metadata?: {
    language?: string;
    command?: string;
    exitCode?: number;
    source?: string;
    title?: string;
    eventId?: string;
    runId?: string;
  };
}

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export type RunStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface CodebaseRun {
  id: string;
  title: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  repo?: string;
  branch?: string;
}

export interface CodebaseRunEvent {
  id: string;
  runId: string;
  seq?: number;
  type: string;
  message: string;
  createdAt: string;
  payload?: Record<string, unknown>;
}

export interface RealtimeTokenPayload {
  token: string;
  websocketUrl?: string;
  model?: string;
  expiresAt?: number;
}
