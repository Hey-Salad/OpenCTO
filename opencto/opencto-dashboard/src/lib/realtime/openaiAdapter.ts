import {
  CONNECT_TIMEOUT_MS,
  TOOLS,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  executeToolProxy,
  loadPcmCaptureWorklet,
  parseMessagePayload,
  type AgentEvent,
  type CTOAgentConfig,
} from './shared'
import { getAuthHeaders } from '../authToken'
import { getWorkspaceId } from '../workspace'

export class OpenAIRealtimeAdapter {
  private ws: WebSocket | null = null
  private captureCtx: AudioContext | null = null
  private playbackCtx: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private workletNode: AudioWorkletNode | null = null
  private nextPlaybackTime = 0
  private assistantBuffer = ''
  private inputTranscriptBufferByItem = new Map<string, string>()
  private hasEmittedSessionEnded = false
  private handledToolCallIds = new Set<string>()
  private hasPendingInputAudio = false
  private isDisconnecting = false

  constructor(
    private readonly tokenUrl: string,
    private readonly config: CTOAgentConfig,
    private readonly onEvent: (ev: AgentEvent) => void,
  ) {}

  async connect(): Promise<void> {
    this.isDisconnecting = false
    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        workspaceId: getWorkspaceId(),
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Token request failed (${res.status}): ${text}`)
    }

    const { clientSecret } = (await res.json()) as { clientSecret?: string }
    if (!clientSecret) throw new Error('Token response missing clientSecret')

    this.hasEmittedSessionEnded = false
    this.ws = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.config.model)}`,
      ['realtime', `openai-insecure-api-key.${clientSecret}`],
    )

    await new Promise<void>((resolve, reject) => {
      const ws = this.ws
      if (!ws) {
        reject(new Error('WebSocket not initialized'))
        return
      }

      let settled = false
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error('OpenAI realtime connection timed out'))
      }, CONNECT_TIMEOUT_MS)

      ws.onopen = () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        this.isDisconnecting = false
        this._sendSessionUpdate()
        this.playbackCtx = new AudioContext({ sampleRate: 24000 })
        this.onEvent({ type: 'session_started' })
        resolve()
      }

      ws.onerror = () => {
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          reject(new Error('WebSocket connection error'))
        }
        if (!this.isDisconnecting) {
          this.onEvent({ type: 'error', message: '[openai] WebSocket connection error' })
        }
      }

      ws.onclose = (event: CloseEvent) => {
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          reject(new Error(`WebSocket closed before open (code ${event.code}${event.reason ? `: ${event.reason}` : ''})`))
        } else if (event.code !== 1000 && !this.isDisconnecting) {
          this.onEvent({
            type: 'error',
            message: `[openai] WebSocket closed (code ${event.code}${event.reason ? `: ${event.reason}` : ''})`,
          })
        }
        this._emitSessionEndedOnce()
      }

      ws.onmessage = (event: MessageEvent<unknown>) => {
        void this._handleIncoming(event.data)
      }
    })
  }

  disconnect(): void {
    this.isDisconnecting = true
    this.stopMicrophone()
    void this.playbackCtx?.close()
    this.playbackCtx = null
    this.nextPlaybackTime = 0
    this.assistantBuffer = ''
    this.handledToolCallIds.clear()
    this.inputTranscriptBufferByItem.clear()
    this.hasPendingInputAudio = false
    this.ws?.close()
    this.ws = null
    this._emitSessionEndedOnce()
  }

  async startMicrophone(): Promise<void> {
    if (this.captureCtx) return

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.captureCtx = new AudioContext({ sampleRate: 24000 })
    await loadPcmCaptureWorklet(this.captureCtx)

    const source = this.captureCtx.createMediaStreamSource(this.mediaStream)
    this.workletNode = new AudioWorkletNode(this.captureCtx, 'pcm-capture-processor')

    this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      const audio = arrayBufferToBase64(event.data)
      this._send({ type: 'input_audio_buffer.append', audio })
      this.hasPendingInputAudio = true
    }

    source.connect(this.workletNode)
    this.workletNode.connect(this.captureCtx.destination)
  }

  stopMicrophone(): void {
    // Push-to-talk fallback: finalize buffered audio when user releases mic.
    if (this.hasPendingInputAudio) {
      this._send({ type: 'input_audio_buffer.commit' })
      this._send({ type: 'response.create', response: {} })
      this.hasPendingInputAudio = false
    }
    this.workletNode?.disconnect()
    this.workletNode = null
    this.mediaStream?.getTracks().forEach((t) => t.stop())
    this.mediaStream = null
    void this.captureCtx?.close()
    this.captureCtx = null
  }

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

  private _emitSessionEndedOnce(): void {
    if (this.hasEmittedSessionEnded) return
    this.hasEmittedSessionEnded = true
    this.onEvent({ type: 'session_ended' })
  }

  private _sendSessionUpdate(): void {
    const c = this.config
    this._send({
      type: 'session.update',
      session: {
        type: 'realtime',
        output_modalities: ['audio'],
        instructions: c.instructions,
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 },
            transcription: { model: c.transcriptModel || 'whisper-1' },
            turn_detection: c.turnDetection
              ? {
                  type: 'server_vad',
                  threshold: c.threshold,
                  prefix_padding_ms: c.prefixPadding,
                  silence_duration_ms: c.silenceDuration,
                  create_response: true,
                }
              : null,
          },
          output: {
            format: { type: 'audio/pcm', rate: 24000 },
            voice: c.voice,
          },
        },
        tools: TOOLS,
        tool_choice: 'auto',
      },
    })
  }

  private async _handleIncoming(raw: unknown): Promise<void> {
    try {
      const event = await parseMessagePayload(raw)
      if (!event) return

      console.log('[Agent][openai]', event.type, event)

      switch (event.type) {
        case 'session.created':
        case 'session.updated':
        case 'response.audio.done':
        case 'response.output_audio.done':
        case 'response.done':
          break
        case 'conversation.item.input_audio_transcription.delta': {
          const itemId = (event.item_id as string | undefined) ?? ''
          if (!itemId) break
          const nextDelta = (event.delta as string | undefined) ?? ''
          const prev = this.inputTranscriptBufferByItem.get(itemId) ?? ''
          this.inputTranscriptBufferByItem.set(itemId, prev + nextDelta)
          break
        }
        case 'conversation.item.input_audio_transcription.segment': {
          const text = ((event.text as string | undefined) ?? '').trim()
          if (text) this.onEvent({ type: 'user_transcript', text })
          break
        }
        case 'conversation.item.input_audio_transcription.completed': {
          const itemId = (event.item_id as string | undefined) ?? ''
          const buffered = itemId ? (this.inputTranscriptBufferByItem.get(itemId) ?? '') : ''
          const text = (((event.transcript as string | undefined) ?? buffered) || '').trim()
          if (text) this.onEvent({ type: 'user_transcript', text })
          if (itemId) this.inputTranscriptBufferByItem.delete(itemId)
          break
        }
        case 'response.audio_transcript.delta':
        case 'response.output_audio_transcript.delta': {
          this.assistantBuffer += (event.delta as string | undefined) ?? ''
          break
        }
        case 'response.audio_transcript.done':
        case 'response.output_audio_transcript.done': {
          const doneTranscript = (event.transcript as string | undefined) ?? ''
          const text = (doneTranscript || this.assistantBuffer).trim()
          if (text) this.onEvent({ type: 'assistant_transcript_done', text })
          this.assistantBuffer = ''
          break
        }
        case 'response.audio.delta':
        case 'response.output_audio.delta': {
          const delta = event.delta as string | undefined
          if (delta) void this._schedulePlayback(base64ToArrayBuffer(delta))
          break
        }
        case 'response.function_call_arguments.done': {
          void this._handleToolCall((event.call_id as string | undefined) ?? '', (event.name as string | undefined) ?? '', (event.arguments as string | undefined) ?? '{}')
          break
        }
        case 'response.output_item.done': {
          const item = event.item as Record<string, unknown> | undefined
          if (item?.type === 'function_call') {
            void this._handleToolCall(
              (item.call_id as string | undefined) ?? '',
              (item.name as string | undefined) ?? '',
              (item.arguments as string | undefined) ?? '{}',
            )
          }
          break
        }
        case 'error': {
          const err = event.error as Record<string, unknown> | undefined
          const message = (err?.message as string | undefined) ?? 'Unknown realtime error'
          this.onEvent({ type: 'error', message: `[openai] ${message}` })
          break
        }
        default:
          break
      }
    } catch (error) {
      console.error('[Agent][openai] parse failure', error)
      this.onEvent({ type: 'error', message: '[openai] Received malformed realtime event' })
    }
  }

  private async _handleToolCall(callId: string, name: string, rawArgs: string): Promise<void> {
    if (!callId || !name) return
    if (this.handledToolCallIds.has(callId)) return
    this.handledToolCallIds.add(callId)

    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(rawArgs) as Record<string, unknown>
    } catch {
      args = {}
    }

    this.onEvent({ type: 'tool_start', toolName: name })
    try {
      const output = await executeToolProxy(name, args)
      this._send({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: callId, output },
      })
      this._send({ type: 'response.create', response: {} })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this._send({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ error: message }) },
      })
      this._send({ type: 'response.create', response: {} })
      this.onEvent({ type: 'error', message: `[openai] Tool ${name} failed: ${message}` })
    } finally {
      this.onEvent({ type: 'tool_end', toolName: name })
    }
  }

  private async _schedulePlayback(buffer: ArrayBuffer): Promise<void> {
    const ctx = this.playbackCtx
    if (!ctx || !buffer.byteLength) return
    if (ctx.state === 'suspended') await ctx.resume()

    const pcm16 = new Int16Array(buffer)
    const float32 = new Float32Array(pcm16.length)
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000)
    audioBuffer.copyToChannel(float32, 0)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)

    const startAt = Math.max(ctx.currentTime, this.nextPlaybackTime)
    source.start(startAt)
    this.nextPlaybackTime = startAt + audioBuffer.duration
  }

  private _send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }
}
