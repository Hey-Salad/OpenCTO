import { GitHubModelsAdapter } from './realtime/githubAdapter'
import { GoogleLiveAdapter } from './realtime/googleAdapter'
import { OpenAIRealtimeAdapter } from './realtime/openaiAdapter'
import { isGeminiLiveModel, isOpenAIRealtimeModel } from './realtime/shared'

export type { AgentEvent, CTOAgentConfig } from './realtime/shared'
import type { AgentEvent, CTOAgentConfig } from './realtime/shared'

type RealtimeAdapter = {
  connect: () => Promise<void>
  disconnect: () => void
  startMicrophone: () => Promise<void>
  stopMicrophone: () => void
  sendText: (text: string) => void
}

export class CTOAgentSession {
  private adapter: RealtimeAdapter | null = null

  constructor(
    private readonly tokenUrl: string,
    private readonly config: CTOAgentConfig,
    private readonly onEvent: (ev: AgentEvent) => void,
  ) {}

  async connect(): Promise<void> {
    if (this.adapter) return

    const nextAdapter: RealtimeAdapter = isGeminiLiveModel(this.config.model)
      ? new GoogleLiveAdapter(this.config, this.onEvent)
      : isOpenAIRealtimeModel(this.config.model)
        ? new OpenAIRealtimeAdapter(this.tokenUrl, this.config, this.onEvent)
        : new GitHubModelsAdapter(this.config, this.onEvent)

    this.adapter = nextAdapter

    try {
      await nextAdapter.connect()
    } catch (error) {
      this.adapter = null
      throw error
    }
  }

  disconnect(): void {
    const active = this.adapter
    this.adapter = null
    active?.disconnect()
  }

  async startMicrophone(): Promise<void> {
    if (!this.adapter) throw new Error('Session is not connected')
    await this.adapter.startMicrophone()
  }

  stopMicrophone(): void {
    this.adapter?.stopMicrophone()
  }

  sendText(text: string): void {
    this.adapter?.sendText(text)
  }
}
