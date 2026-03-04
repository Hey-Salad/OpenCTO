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

export interface RealtimeTranscriptEvent {
  role: 'USER' | 'ASSISTANT';
  text: string;
}

type Listener = (snapshot: RealtimeSessionSnapshot) => void;
type TranscriptListener = (event: RealtimeTranscriptEvent) => void;

export class RealtimeSessionManager {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private transcriptListeners = new Set<TranscriptListener>();
  private reconnectAttempted = false;
  private snapshot: RealtimeSessionSnapshot = {
    state: 'idle',
    muted: false,
    fallbackToText: false
  };

  constructor(
    private readonly client: ApiClient,
    private readonly workspaceId?: string
  ) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  subscribeTranscripts(listener: TranscriptListener): () => void {
    this.transcriptListeners.add(listener);
    return () => this.transcriptListeners.delete(listener);
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
      const tokenPayload = await getRealtimeToken(this.client, this.workspaceId);
      const model = tokenPayload.model ?? 'gpt-4o-realtime-preview';
      const url = tokenPayload.websocketUrl ?? `wss://api.openai.com/v1/realtime?model=${model}`;
      const token = tokenPayload.token?.trim();

      if (!token) {
        throw new Error('Realtime token response missing token');
      }

      this.openSocket(url, token);
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
    this.ws = new WebSocket(url, ['realtime', `openai-insecure-api-key.${token}`]);

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

    this.ws.onmessage = (message) => {
      const transcriptEvent = this.extractTranscriptEvent(message.data);
      if (transcriptEvent) {
        this.emitTranscript(transcriptEvent);
      }
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

  private emitTranscript(event: RealtimeTranscriptEvent): void {
    this.transcriptListeners.forEach((listener) => listener(event));
  }

  private extractTranscriptEvent(raw: unknown): RealtimeTranscriptEvent | null {
    if (typeof raw !== 'string') {
      return null;
    }

    try {
      const payload = JSON.parse(raw) as {
        type?: string;
        transcript?: string;
        text?: string;
      };

      const text = (payload.transcript ?? payload.text ?? '').trim();
      if (!text) {
        return null;
      }

      const type = payload.type ?? '';

      if (type === 'conversation.item.input_audio_transcription.completed') {
        return { role: 'USER', text };
      }

      if (
        type === 'response.audio_transcript.done' ||
        type === 'response.output_text.done' ||
        type === 'response.output_text.final'
      ) {
        return { role: 'ASSISTANT', text };
      }
    } catch {
      return null;
    }

    return null;
  }
}
