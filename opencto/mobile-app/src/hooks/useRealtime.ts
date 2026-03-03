import { useEffect, useMemo, useState } from 'react';
import { RealtimeSessionManager, RealtimeSessionSnapshot } from '@/realtime/sessionManager';
import { useAuthContext } from '@/state/AuthContext';

const initialSnapshot: RealtimeSessionSnapshot = {
  state: 'idle',
  muted: false,
  fallbackToText: false
};

export const useRealtime = () => {
  const { api } = useAuthContext();
  const manager = useMemo(() => new RealtimeSessionManager(api.client), [api]);
  const [snapshot, setSnapshot] = useState<RealtimeSessionSnapshot>(initialSnapshot);

  useEffect(() => {
    return manager.subscribe(setSnapshot);
  }, [manager]);

  return {
    ...snapshot,
    start: () => manager.start(),
    stop: () => manager.stop(),
    toggleMute: () => manager.toggleMute()
  };
};
