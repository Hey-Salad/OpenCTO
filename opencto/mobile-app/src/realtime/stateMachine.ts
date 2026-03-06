import { RealtimeConnectionState } from '@/types/models';

export type RealtimeEvent =
  | 'CONNECT'
  | 'CONNECTED'
  | 'DISCONNECT'
  | 'RECONNECT'
  | 'RECONNECT_FAILED'
  | 'FAIL'
  | 'END';

const transitions: Record<RealtimeConnectionState, Partial<Record<RealtimeEvent, RealtimeConnectionState>>> = {
  idle: {
    CONNECT: 'connecting',
    END: 'ended'
  },
  connecting: {
    CONNECTED: 'live',
    FAIL: 'error',
    DISCONNECT: 'reconnecting',
    END: 'ended'
  },
  live: {
    DISCONNECT: 'reconnecting',
    FAIL: 'error',
    END: 'ended'
  },
  reconnecting: {
    CONNECTED: 'live',
    RECONNECT_FAILED: 'error',
    END: 'ended'
  },
  error: {
    CONNECT: 'connecting',
    END: 'ended'
  },
  ended: {
    CONNECT: 'connecting'
  }
};

export const transitionRealtimeState = (
  current: RealtimeConnectionState,
  event: RealtimeEvent
): RealtimeConnectionState => {
  return transitions[current][event] ?? current;
};
