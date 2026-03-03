import { describe, expect, it } from 'vitest';
import { transitionRealtimeState } from '@/realtime/stateMachine';

describe('transitionRealtimeState', () => {
  it('transitions idle -> connecting -> live', () => {
    const connecting = transitionRealtimeState('idle', 'CONNECT');
    const live = transitionRealtimeState(connecting, 'CONNECTED');
    expect(connecting).toBe('connecting');
    expect(live).toBe('live');
  });

  it('handles reconnect failure path', () => {
    const reconnecting = transitionRealtimeState('live', 'DISCONNECT');
    const error = transitionRealtimeState(reconnecting, 'RECONNECT_FAILED');
    expect(reconnecting).toBe('reconnecting');
    expect(error).toBe('error');
  });
});
