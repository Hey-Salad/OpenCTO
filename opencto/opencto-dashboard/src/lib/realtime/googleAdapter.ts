import {
  CONNECT_TIMEOUT_MS,
  TOOLS,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  createGoogleLiveSession,
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
  private isDisconnecting = false
  private latestInputTranscript = ''
  private latestOutputTranscript = ''
  private latestInputTranscriptAt = 0
  private latestOutputTranscriptAt = 0

  constructor(
    private readonly config: CTOAgentConfig,
    private readonly onEvent: (ev: AgentEvent) => void,
  ) {}

  async connect(): Promise<void> {
    this.isDisconnecting = false
    this.latestInputTranscript = ''
    this.latestOutputTranscript = ''
    this.latestInputTranscriptAt = 0
    this.latestOutputTranscriptAt = 0
    this.hasEmittedSessionEnded = false
    this.handledToolCallIds.clear()
    const bootstrap = await createGoogleLiveSession(this.config)
    await this._connectSocket(bootstrap.wsUrl, `session_token=${encodeURIComponent(bootstrap.sessionToken)}`)
  }

  private async _connectSocket(baseUrl: string, query?: string): Promise<void> {
    const wsUrl = query ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query}` : baseUrl
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
        this.isDisconnecting = false
        this._sendLegacySetup()
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
        if (!this.isDisconnecting) {
          this.onEvent({ type: 'error', message: '[google] WebSocket connection error' })
        }
      }

      ws.onclose = (event: CloseEvent) => {
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          reject(new Error(`Google WebSocket closed before open (code ${event.code}${event.reason ? `: ${event.reason}` : ''})`))
        } else if (event.code !== 1000 && !this.isDisconnecting) {
          this.onEvent({
            type: 'error',
            message: `[google] WebSocket closed (code ${event.code}${event.reason ? `: ${event.reason}` : ''})`,
          })
        }
        this._emitSessionEndedOnce()
      }

      ws.onmessage = (event: MessageEvent<unknown>) => {
        void this._handleLegacyIncoming(event.data)
      }
    })
  }

  disconnect(): void {
    this.isDisconnecting = true
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
      const audio = arrayBufferToBase64(event.data)
      this._sendLegacy({
        realtimeInput: {
          audio: {
            data: audio,
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
    this._sendLegacy({
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

  private _sendLegacySetup(): void {
    const requestedModel = this.config.model
    const selectedModel = selectSupportedGoogleLiveModel(requestedModel)
    if (selectedModel !== requestedModel && selectedModel !== requestedModel.replace(/^models\//, '')) {
      this.onEvent({
        type: 'error',
        message: `[google] Unsupported realtime model "${requestedModel}". Falling back to "${selectedModel}".`,
      })
    }

    this._sendLegacy({
      setup: {
        model: normalizeGeminiModel(selectedModel),
        generationConfig: { responseModalities: ['AUDIO'] },
        systemInstruction: { parts: [{ text: this.config.instructions }] },
        voice: this.config.voice,
        agentProfile: this.config.agentProfile ?? 'dispatch',
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

  private async _handleLegacyIncoming(raw: unknown): Promise<void> {
    try {
      const event = await parseMessagePayload(raw)
      if (!event) return

      const setupComplete = event.setupComplete as Record<string, unknown> | undefined
      if (setupComplete?.error) {
        this.onEvent({ type: 'error', message: `[google] ${String(setupComplete.error)}` })
      }

      const inputTranscription =
        (event.inputTranscription as Record<string, unknown> | undefined)
        ?? ((event.serverContent as Record<string, unknown> | undefined)?.inputTranscription as Record<string, unknown> | undefined)
      const inputText = (inputTranscription?.text as string | undefined) ?? ''
      const normalizedInputText = inputText.trim()
      if (
        normalizedInputText
        && !(
          normalizedInputText === this.latestInputTranscript
          && Date.now() - this.latestInputTranscriptAt < 1500
        )
      ) {
        this.latestInputTranscript = normalizedInputText
        this.latestInputTranscriptAt = Date.now()
        this.onEvent({ type: 'user_transcript', text: normalizedInputText })
      }

      const outputTranscription =
        (event.outputTranscription as Record<string, unknown> | undefined)
        ?? ((event.serverContent as Record<string, unknown> | undefined)?.outputTranscription as Record<string, unknown> | undefined)
      const outputText = (outputTranscription?.text as string | undefined) ?? ''
      const normalizedOutputText = outputText.trim()
      if (
        normalizedOutputText
        && !(
          normalizedOutputText === this.latestOutputTranscript
          && Date.now() - this.latestOutputTranscriptAt < 1500
        )
      ) {
        this.latestOutputTranscript = normalizedOutputText
        this.latestOutputTranscriptAt = Date.now()
        this.onEvent({ type: 'assistant_transcript_done', text: normalizedOutputText })
      }

      const serverContent = event.serverContent as Record<string, unknown> | undefined
      if (serverContent?.interrupted) {
        const ctx = this.playbackCtx
        if (ctx) this.nextPlaybackTime = ctx.currentTime
      }

      const modelTurn = serverContent?.modelTurn as Record<string, unknown> | undefined
      const parts = (modelTurn?.parts as Array<Record<string, unknown>> | undefined) ?? []
      for (const part of parts) {
        const text = part.text as string | undefined
        const normalizedPartText = text?.trim() ?? ''
        if (
          normalizedPartText
          && !(
            normalizedPartText === this.latestOutputTranscript
            && Date.now() - this.latestOutputTranscriptAt < 1500
          )
        ) {
          this.latestOutputTranscript = normalizedPartText
          this.latestOutputTranscriptAt = Date.now()
          this.onEvent({ type: 'assistant_transcript_done', text: normalizedPartText })
        }

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
        void this._handleLegacyToolCall(id, name, args)
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

  private async _handleLegacyToolCall(callId: string, name: string, args: Record<string, unknown>): Promise<void> {
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

      this._sendLegacy({
        toolResponse: {
          functionResponses: [{ id: callId, name, response }],
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this._sendLegacy({
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

  private _sendLegacy(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }
}
