import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ChatMessage, ChatSummary } from '@/types/models';
import { createId } from '@/utils/id';
import { useAuthContext } from './AuthContext';

interface ChatContextValue {
  chats: ChatSummary[];
  messages: ChatMessage[];
  activeChatId: string | null;
  loading: boolean;
  error: string | null;
  loadChats: () => Promise<void>;
  openChat: (chatId: string) => Promise<void>;
  sendTextMessage: (content: string) => Promise<void>;
  appendMessage: (input: Omit<ChatMessage, 'id' | 'chatId' | 'createdAt'> & { id?: string }) => Promise<void>;
  upsertMessage: (message: ChatMessage) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatProvider = ({ children }: PropsWithChildren) => {
  const { api, session } = useAuthContext();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChats = useCallback(async () => {
    if (!session) {
      return;
    }
    setLoading(true);
    try {
      const next = await api.chat.getChats(api.client);
      setChats(next);
      const first = next[0]?.id ?? null;
      if (first && !activeChatId) {
        setActiveChatId(first);
      }
      setError(null);
    } catch {
      setError('Failed to load chats.');
    } finally {
      setLoading(false);
    }
  }, [api, session, activeChatId]);

  const openChat = useCallback(
    async (chatId: string) => {
      setLoading(true);
      try {
        const next = await api.chat.getChatById(api.client, chatId);
        setMessages(next);
        setActiveChatId(chatId);
        setError(null);
      } catch {
        setError('Failed to load chat.');
      } finally {
        setLoading(false);
      }
    },
    [api]
  );

  const sendTextMessage = useCallback(
    async (content: string) => {
      const chatId = activeChatId ?? `chat_${Date.now()}`;
      if (!activeChatId) {
        setActiveChatId(chatId);
      }

      const nextMessage: ChatMessage = {
        id: createId('msg'),
        chatId,
        role: 'USER',
        content,
        kind: 'speech',
        createdAt: new Date().toISOString()
      };

      const nextMessages = [...messages, nextMessage];
      setMessages(nextMessages);

      try {
        await api.chat.saveChat(api.client, {
          chatId,
          messages: nextMessages
        });
        setError(null);
      } catch {
        setError('Message saved locally. Sync will retry on next update.');
      }
    },
    [activeChatId, api, messages]
  );

  const persistMessages = useCallback(
    async (chatId: string, nextMessages: ChatMessage[]) => {
      setMessages(nextMessages);
      try {
        await api.chat.saveChat(api.client, {
          chatId,
          messages: nextMessages
        });
        setError(null);
      } catch {
        setError('Message saved locally. Sync will retry on next update.');
      }
    },
    [api]
  );

  const appendMessage = useCallback(
    async (input: Omit<ChatMessage, 'id' | 'chatId' | 'createdAt'> & { id?: string }) => {
      const chatId = activeChatId ?? `chat_${Date.now()}`;
      if (!activeChatId) {
        setActiveChatId(chatId);
      }
      const nextMessage: ChatMessage = {
        id: input.id ?? createId('msg'),
        chatId,
        role: input.role,
        content: input.content,
        kind: input.kind,
        metadata: input.metadata,
        createdAt: new Date().toISOString()
      };
      await persistMessages(chatId, [...messages, nextMessage]);
    },
    [activeChatId, messages, persistMessages]
  );

  const upsertMessage = useCallback(
    async (message: ChatMessage) => {
      const chatId = activeChatId ?? message.chatId ?? `chat_${Date.now()}`;
      const next = [...messages];
      const index = next.findIndex((item) => item.id === message.id);
      if (index >= 0) {
        next[index] = message;
      } else {
        next.push(message);
      }
      await persistMessages(chatId, next);
    },
    [activeChatId, messages, persistMessages]
  );

  useEffect(() => {
    if (!session) {
      setChats([]);
      setMessages([]);
      setActiveChatId(null);
      return;
    }

    loadChats();
  }, [session, loadChats]);

  useEffect(() => {
    if (activeChatId) {
      openChat(activeChatId);
    }
  }, [activeChatId, openChat]);

  return (
    <ChatContext.Provider
      value={{
        chats,
        messages,
        activeChatId,
        loading,
        error,
        loadChats,
        openChat,
        sendTextMessage,
        appendMessage,
        upsertMessage
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = (): ChatContextValue => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used inside ChatProvider');
  }
  return context;
};
