import {
  type AgentEvent,
  type CTOAgentConfig,
} from './shared'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const AUTH_HEADER = { Authorization: 'Bearer demo-token' }

export class GitHubModelsAdapter {
  private hasConnected = false
  private hasEmittedSessionEnded = false

  constructor(
    private readonly config: CTOAgentConfig,
    private readonly onEvent: (ev: AgentEvent) => void,
  ) {}

  async connect(): Promise<void> {
    this.hasConnected = true
    this.hasEmittedSessionEnded = false
    this.onEvent({ type: 'session_started' })
  }

  disconnect(): void {
    this.hasConnected = false
    if (this.hasEmittedSessionEnded) return
    this.hasEmittedSessionEnded = true
    this.onEvent({ type: 'session_ended' })
  }

  async startMicrophone(): Promise<void> {
    throw new Error('Microphone is not supported for GitHub Models yet. Use text input.')
  }

  stopMicrophone(): void {
    // no-op for text-only provider
  }

  sendText(text: string): void {
    if (!this.hasConnected) {
      this.onEvent({ type: 'error', message: '[github] Session is not connected' })
      return
    }

    const trimmed = text.trim()
    if (!trimmed) return

    void this._sendChat(trimmed)
  }

  private async _sendChat(userText: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/v1/agent/respond`, {
        method: 'POST',
        headers: {
          ...AUTH_HEADER,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: userText,
          system: this.config.instructions,
          model: this.config.reasoningModel,
        }),
      })

      const bodyText = await response.text()
      if (!response.ok) {
        this.onEvent({ type: 'error', message: `[github] HTTP ${response.status}: ${bodyText}` })
        return
      }

      const body = JSON.parse(bodyText) as { text?: string }
      const answer = body.text?.trim()
      if (!answer) {
        this.onEvent({ type: 'error', message: '[github] Empty response from supervisor endpoint' })
        return
      }

      this.onEvent({ type: 'assistant_transcript_done', text: answer })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.onEvent({ type: 'error', message: `[github] ${message}` })
    }
  }
}
