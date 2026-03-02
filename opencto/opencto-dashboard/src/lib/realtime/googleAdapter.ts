import {
  CONNECT_TIMEOUT_MS,
  GOOGLE_API_KEY,
  TOOLS,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  executeToolProxy,
  loadPcmCaptureWorklet,
  normalizeGeminiModel,
  parseMessagePayload,
  selectSupportedGoogleLiveModel,
  type AgentEvent,
  type CTOAgentConfig,
} from './shared'

export class GoogleLiveAdapter {
  private ws: WebSocket | null = null
  private captureCtx: AudioContext | null = null
  private playbackCtx: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private workletNode: AudioWorkletNode | null = null
  private nextPlaybackTime = 0
  private hasEmittedSessionEnded = false
  private handledToolCallIds = new Set<string>()

  constructor(
    private readonly config: CTOAgentConfig,
    private readonly onEvent: (ev: AgentEvent) => void,
  ) {}

  async connect(): Promise<void> {
    if (!GOOGLE_API_KEY) throw new Error('VITE_GOOGLE_API_KEY is not set')

    this.hasEmittedSessionEnded = false
    const wsUrls = [
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(GOOGLE_API_KEY)}`,
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(GOOGLE_API_KEY)}`,
    ]

    let lastError: Error | null = null
    for (const wsUrl of wsUrls) {
      try {
        await this._connectSocket(wsUrl)
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        this.ws?.close()
        this.ws = null
      }
    }
    throw lastError ?? new Error('Google Live WebSocket connection failed')
  }

  private async _connectSocket(wsUrl: string): Promise<void> {
    this.ws = new WebSocket(wsUrl)
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
        reject(new Error('Google live connection timed out'))
      }, CONNECT_TIMEOUT_MS)

      ws.onopen = () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        this._sendSetup()
        this.playbackCtx = new AudioContext({ sampleRate: 24000 })
        this.onEvent({ type: 'session_started' })
        resolve()
      }

      ws.onerror = () => {
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          reject(new Error('Google Live WebSocket connection error'))
        }
        this.onEvent({ type: 'error', message: '[google] WebSocket connection error' })
      }

      ws.onclose = (event: CloseEvent) => {
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          reject(new Error(`Google WebSocket closed before open (code ${event.code}${event.reason ? `: ${event.reason}` : ''})`))
        } else if (event.code !== 1000) {
          this.onEvent({
            type: 'error',
            message: `[google] WebSocket closed (code ${event.code}${event.reason ? `: ${event.reason}` : ''})`,
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
    this.stopMicrophone()
    void this.playbackCtx?.close()
    this.playbackCtx = null
    this.nextPlaybackTime = 0
    this.handledToolCallIds.clear()
    this.ws?.close()
    this.ws = null
    this._emitSessionEndedOnce()
  }

  async startMicrophone(): Promise<void> {
    if (this.captureCtx) return

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.captureCtx = new AudioContext({ sampleRate: 16000 })
    await loadPcmCaptureWorklet(this.captureCtx)

    const source = this.captureCtx.createMediaStreamSource(this.mediaStream)
    this.workletNode = new AudioWorkletNode(this.captureCtx, 'pcm-capture-processor')

    this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      this._send({
        realtimeInput: {
          audio: {
            data: arrayBufferToBase64(event.data),
            mimeType: 'audio/pcm;rate=16000',
          },
        },
      })
    }

    source.connect(this.workletNode)
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

  sendText(text: string): void {
    this._send({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      },
    })
  }

  private _emitSessionEndedOnce(): void {
    if (this.hasEmittedSessionEnded) return
    this.hasEmittedSessionEnded = true
    this.onEvent({ type: 'session_ended' })
  }

  private _sendSetup(): void {
    const requestedModel = this.config.model
    const selectedModel = selectSupportedGoogleLiveModel(requestedModel)
    if (selectedModel !== requestedModel && selectedModel !== requestedModel.replace(/^models\//, '')) {
      this.onEvent({
        type: 'error',
        message: `[google] Unsupported realtime model "${requestedModel}". Falling back to "${selectedModel}".`,
      })
    }

    this._send({
      setup: {
        model: normalizeGeminiModel(selectedModel),
        generationConfig: { responseModalities: ['AUDIO'] },
        systemInstruction: { parts: [{ text: this.config.instructions }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [
          {
            functionDeclarations: TOOLS.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            })),
          },
        ],
      },
    })
  }

  private async _handleIncoming(raw: unknown): Promise<void> {
    try {
      const event = await parseMessagePayload(raw)
      if (!event) return

      console.log('[Agent][google]', event)

      const setupComplete = event.setupComplete as Record<string, unknown> | undefined
      if (setupComplete?.error) {
        this.onEvent({ type: 'error', message: `[google] ${String(setupComplete.error)}` })
      }

      const inputTranscription =
        (event.inputTranscription as Record<string, unknown> | undefined)
        ?? ((event.serverContent as Record<string, unknown> | undefined)?.inputTranscription as Record<string, unknown> | undefined)
      const inputText = (inputTranscription?.text as string | undefined) ?? ''
      if (inputText.trim()) this.onEvent({ type: 'user_transcript', text: inputText.trim() })

      const outputTranscription =
        (event.outputTranscription as Record<string, unknown> | undefined)
        ?? ((event.serverContent as Record<string, unknown> | undefined)?.outputTranscription as Record<string, unknown> | undefined)
      const outputText = (outputTranscription?.text as string | undefined) ?? ''
      if (outputText.trim()) this.onEvent({ type: 'assistant_transcript_done', text: outputText.trim() })

      const serverContent = event.serverContent as Record<string, unknown> | undefined
      if (serverContent?.interrupted) {
        const ctx = this.playbackCtx
        if (ctx) this.nextPlaybackTime = ctx.currentTime
      }

      const modelTurn = serverContent?.modelTurn as Record<string, unknown> | undefined
      const parts = (modelTurn?.parts as Array<Record<string, unknown>> | undefined) ?? []
      for (const part of parts) {
        const text = part.text as string | undefined
        if (text?.trim()) this.onEvent({ type: 'assistant_transcript_done', text: text.trim() })

        const inlineData = part.inlineData as Record<string, unknown> | undefined
        const audioData = inlineData?.data
        if (typeof audioData === 'string' && audioData.length > 0) {
          void this._schedulePlayback(base64ToArrayBuffer(audioData))
        }
      }

      const toolCall = event.toolCall as Record<string, unknown> | undefined
      const functionCalls = (toolCall?.functionCalls as Array<Record<string, unknown>> | undefined) ?? []
      for (const call of functionCalls) {
        const id = (call.id as string | undefined) ?? ''
        const name = (call.name as string | undefined) ?? ''
        if (!id || !name) continue
        if (this.handledToolCallIds.has(id)) continue
        this.handledToolCallIds.add(id)

        const args = (call.args as Record<string, unknown> | undefined) ?? {}
        void this._handleToolCall(id, name, args)
      }

      const err = event.error as Record<string, unknown> | undefined
      if (err?.message) {
        this.onEvent({ type: 'error', message: `[google] ${String(err.message)}` })
      }
    } catch (error) {
      console.error('[Agent][google] parse failure', error)
      this.onEvent({ type: 'error', message: '[google] Received malformed live event' })
    }
  }

  private async _handleToolCall(callId: string, name: string, args: Record<string, unknown>): Promise<void> {
    this.onEvent({ type: 'tool_start', toolName: name })
    try {
      const output = await executeToolProxy(name, args)
      const response = (() => {
        try {
          return JSON.parse(output)
        } catch {
          return { output }
        }
      })()

      this._send({
        toolResponse: {
          functionResponses: [{ id: callId, name, response }],
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this._send({
        toolResponse: {
          functionResponses: [{ id: callId, name, response: { error: message } }],
        },
      })
      this.onEvent({ type: 'error', message: `[google] Tool ${name} failed: ${message}` })
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
