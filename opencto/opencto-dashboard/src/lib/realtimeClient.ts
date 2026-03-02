// RealtimeClient — WebSocket bridge to the OpenAI Realtime API
// The browser never holds the main API key; it fetches a short-lived ephemeral
// client secret from our backend and uses that in the WebSocket subprotocol.

export type RealtimeEvent =
  | { type: 'session_started' }
  | { type: 'session_ended' }
  | { type: 'user_transcript'; text: string }
  | { type: 'assistant_transcript_done'; text: string }
  | { type: 'error'; message: string }

export interface RealtimeSessionConfig {
  model: string
  instructions: string
  voice: string
  turnDetection: boolean
  threshold: number
  prefixPadding: number
  silenceDuration: number
  transcriptModel: string
  maxTokens: number
}

// PCM16 worklet code embedded as a string so we can load it via a Blob URL —
// avoids needing a separate public asset file.
const PCM_WORKLET_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0]
    if (channel?.length) {
      const pcm16 = new Int16Array(channel.length)
      for (let i = 0; i < channel.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, channel[i] * 32768))
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer])
    }
    return true
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor)
`

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  // Chunked to avoid call-stack overflow on large buffers
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export class RealtimeClient {
  private ws: WebSocket | null = null

  // Separate AudioContexts for capture and playback so they can be started
  // and stopped independently.
  private captureCtx: AudioContext | null = null
  private playbackCtx: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private workletNode: AudioWorkletNode | null = null

  // Tracks when the next queued audio chunk should start so chunks play
  // back-to-back without gaps or overlaps.
  private nextPlaybackTime = 0

  // Accumulate streaming assistant transcript deltas before emitting.
  private assistantBuffer = ''

  private readonly tokenUrl: string
  private readonly config: RealtimeSessionConfig
  private readonly onEvent: (ev: RealtimeEvent) => void

  constructor(
    tokenUrl: string,
    config: RealtimeSessionConfig,
    onEvent: (ev: RealtimeEvent) => void,
  ) {
    this.tokenUrl = tokenUrl
    this.config = config
    this.onEvent = onEvent
  }

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  async connect(): Promise<void> {
    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer demo-token', // TODO: replace with real session token
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: this.config.model }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Token request failed (${res.status}): ${text}`)
    }
    const { clientSecret } = (await res.json()) as { clientSecret: string }

    this.ws = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.config.model)}`,
      // The ephemeral key is passed as a subprotocol — the safe browser pattern
      // since the Fetch API can't set custom headers on WebSocket upgrades.
      ['realtime', `openai-insecure-api-key.${clientSecret}`],
    )

    this.ws.onopen = () => {
      this._sendSessionUpdate()
      this.onEvent({ type: 'session_started' })
    }

    this.ws.onmessage = (e: MessageEvent<string>) => {
      try {
        this._handleServerEvent(JSON.parse(e.data) as Record<string, unknown>)
      } catch {
        // Ignore unparseable frames
      }
    }

    this.ws.onerror = () => {
      this.onEvent({ type: 'error', message: 'WebSocket connection error' })
    }

    this.ws.onclose = () => {
      this.onEvent({ type: 'session_ended' })
    }

    // Create the playback context here — we're inside a user-gesture handler
    // (the Start Session button click), so autoplay policy allows it.
    this.playbackCtx = new AudioContext({ sampleRate: 24000 })
  }

  disconnect(): void {
    this.stopMicrophone()
    void this.playbackCtx?.close()
    this.playbackCtx = null
    this.nextPlaybackTime = 0
    this.assistantBuffer = ''
    this.ws?.close()
    this.ws = null
  }

  // ---------------------------------------------------------------------------
  // Microphone
  // ---------------------------------------------------------------------------

  async startMicrophone(): Promise<void> {
    if (this.captureCtx) return // already active

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.captureCtx = new AudioContext({ sampleRate: 24000 })

    // Load the PCM worklet from a Blob URL
    const blob = new Blob([PCM_WORKLET_CODE], { type: 'application/javascript' })
    const blobUrl = URL.createObjectURL(blob)
    await this.captureCtx.audioWorklet.addModule(blobUrl)
    URL.revokeObjectURL(blobUrl)

    const source = this.captureCtx.createMediaStreamSource(this.mediaStream)
    this.workletNode = new AudioWorkletNode(this.captureCtx, 'pcm-capture-processor')

    this.workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      const b64 = arrayBufferToBase64(e.data)
      this._send({ type: 'input_audio_buffer.append', audio: b64 })
    }

    source.connect(this.workletNode)
    // Connect to destination to keep the worklet alive (silent — no audible output)
    this.workletNode.connect(this.captureCtx.destination)
  }

  stopMicrophone(): void {
    this.workletNode?.disconnect()
    this.workletNode = null
    this.mediaStream?.getTracks().forEach((t) => t.stop())
    this.mediaStream = null
    void this.captureCtx?.close()
    this.captureCtx = null
  }

  // ---------------------------------------------------------------------------
  // Text input
  // ---------------------------------------------------------------------------

  sendText(text: string): void {
    this._send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    })
    this._send({ type: 'response.create', response: {} })
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _sendSessionUpdate(): void {
    const c = this.config
    this._send({
      type: 'session.update',
      session: {
        type: 'realtime',
        modalities: ['text', 'audio'],
        instructions: c.instructions,
        voice: c.voice,
        // Required to receive conversation.item.input_audio_transcription.completed events
        input_audio_transcription: {
          model: c.transcriptModel || 'whisper-1',
        },
        turn_detection: c.turnDetection
          ? {
              type: 'server_vad',
              threshold: c.threshold,
              prefix_padding_ms: c.prefixPadding,
              silence_duration_ms: c.silenceDuration,
              create_response: true,
            }
          : null,
        max_response_output_tokens: c.maxTokens,
      },
    })
  }

  private _handleServerEvent(event: Record<string, unknown>): void {
    // Temporary: log every event so we can see what the GA API sends
    console.log('[Realtime]', event.type, event)

    switch (event.type) {
      case 'conversation.item.input_audio_transcription.completed': {
        const text = ((event.transcript as string | undefined) ?? '').trim()
        if (text) this.onEvent({ type: 'user_transcript', text })
        break
      }

      case 'response.audio_transcript.delta': {
        this.assistantBuffer += (event.delta as string | undefined) ?? ''
        break
      }

      case 'response.audio_transcript.done': {
        const text = this.assistantBuffer.trim()
        if (text) this.onEvent({ type: 'assistant_transcript_done', text })
        this.assistantBuffer = ''
        break
      }

      case 'response.audio.delta': {
        void this._playAudioChunk(event.delta as string)
        break
      }

      case 'error': {
        const err = event.error as Record<string, unknown> | undefined
        this.onEvent({
          type: 'error',
          message: (err?.message as string | undefined) ?? 'Unknown realtime error',
        })
        break
      }
    }
  }

  private async _playAudioChunk(b64Audio: string): Promise<void> {
    const ctx = this.playbackCtx
    if (!ctx || !b64Audio) return

    // Decode base64 → PCM16 → Float32
    const raw = atob(b64Audio)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)

    const pcm16 = new Int16Array(bytes.buffer)
    const float32 = new Float32Array(pcm16.length)
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768

    const buffer = ctx.createBuffer(1, float32.length, 24000)
    buffer.copyToChannel(float32, 0)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)

    // Schedule back-to-back to avoid clicks between chunks
    const startAt = Math.max(ctx.currentTime, this.nextPlaybackTime)
    source.start(startAt)
    this.nextPlaybackTime = startAt + buffer.duration
  }

  private _send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }
}
