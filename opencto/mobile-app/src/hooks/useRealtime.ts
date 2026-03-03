import { useEffect, useMemo, useState } from 'react';
import {
  RealtimeSessionManager,
  RealtimeSessionSnapshot,
  RealtimeTranscriptEvent
} from '@/realtime/sessionManager';
import { useAuthContext } from '@/state/AuthContext';

const initialSnapshot: RealtimeSessionSnapshot = {
  state: 'idle',
  muted: false,
  fallbackToText: false
};

interface UseRealtimeOptions {
  onTranscript?: (event: RealtimeTranscriptEvent) => void;
}

export const useRealtime = (options: UseRealtimeOptions = {}) => {
  const { api, session } = useAuthContext();
  const manager = useMemo(
    () => new RealtimeSessionManager(api.client, session?.workspaceId),
    [api, session?.workspaceId]
  );
  const [snapshot, setSnapshot] = useState<RealtimeSessionSnapshot>(initialSnapshot);

  useEffect(() => {
    return manager.subscribe(setSnapshot);
  }, [manager]);

  useEffect(() => {
    if (!options.onTranscript) {
      return;
    }
    return manager.subscribeTranscripts(options.onTranscript);
  }, [manager, options.onTranscript]);

  return {
    ...snapshot,
    start: () => manager.start(),
    stop: () => manager.stop(),
    toggleMute: () => manager.toggleMute()
  };
};
