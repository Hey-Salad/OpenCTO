import { getRealtimeToken } from '@/api/realtime';
import { ApiClient } from '@/api/http';
import { requestMicrophonePermission, configureAudioSession } from '@/audio/microphone';
import { RealtimeConnectionState } from '@/types/models';
import { transitionRealtimeState } from './stateMachine';

export interface RealtimeSessionSnapshot {
  state: RealtimeConnectionState;
  muted: boolean;
  startedAt?: number;
  fallbackToText: boolean;
  errorMessage?: string;
}

type Listener = (snapshot: RealtimeSessionSnapshot) => void;

export class RealtimeSessionManager {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectAttempted = false;
  private snapshot: RealtimeSessionSnapshot = {
    state: 'idle',
    muted: false,
    fallbackToText: false
  };

  constructor(private readonly client: ApiClient) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): RealtimeSessionSnapshot {
    return this.snapshot;
  }

  async start(): Promise<void> {
    this.updateState('CONNECT');

    const permissionGranted = await requestMicrophonePermission();
    if (!permissionGranted) {
      this.snapshot = {
        ...this.snapshot,
        state: 'error',
        errorMessage: 'Microphone access is required for realtime voice.'
      };
      this.emit();
      return;
    }

    await configureAudioSession();

    try {
      const tokenPayload = await getRealtimeToken(this.client);
      const model = tokenPayload.model ?? 'gpt-4o-realtime-preview';
      const url = tokenPayload.websocketUrl ?? `wss://api.openai.com/v1/realtime?model=${model}`;

      this.openSocket(url, tokenPayload.token);
    } catch {
      this.snapshot = {
        ...this.snapshot,
        state: 'error',
        errorMessage: 'Failed to start realtime session.'
      };
      this.emit();
    }
  }

  stop(): void {
    this.ws?.close();
    this.ws = null;
    this.reconnectAttempted = false;
    this.snapshot = {
      ...this.snapshot,
      state: 'ended',
      startedAt: undefined
    };
    this.emit();
  }

  toggleMute(): void {
    this.snapshot = {
      ...this.snapshot,
      muted: !this.snapshot.muted
    };
    this.emit();
  }

  private openSocket(url: string, token: string): void {
    this.ws = new WebSocket(url, undefined, {
      headers: {
        Authorization: `Bearer ${token}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    } as never);

    this.ws.onopen = () => {
      this.updateState('CONNECTED');
      this.snapshot = {
        ...this.snapshot,
        startedAt: Date.now(),
        fallbackToText: false,
        errorMessage: undefined
      };
      this.emit();
    };

    this.ws.onclose = () => {
      if (this.snapshot.state === 'ended') {
        return;
      }
      this.handleDisconnect(url, token);
    };

    this.ws.onerror = () => {
      this.snapshot = {
        ...this.snapshot,
        errorMessage: 'Realtime connection error.'
      };
      this.emit();
    };
  }

  private handleDisconnect(url: string, token: string): void {
    if (!this.reconnectAttempted) {
      this.reconnectAttempted = true;
      this.updateState('DISCONNECT');
      this.openSocket(url, token);
      return;
    }

    this.updateState('RECONNECT_FAILED');
    this.snapshot = {
      ...this.snapshot,
      fallbackToText: true,
      errorMessage: 'Realtime reconnect failed. Continue in text mode.'
    };
    this.emit();
  }

  private updateState(event: Parameters<typeof transitionRealtimeState>[1]): void {
    this.snapshot = {
      ...this.snapshot,
      state: transitionRealtimeState(this.snapshot.state, event)
    };
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
}
