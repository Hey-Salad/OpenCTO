import { GitHubModelsAdapter } from './githubAdapter'
import type { AgentEvent, CTOAgentConfig } from './shared'

const baseConfig: CTOAgentConfig = {
  model: 'github/openai/gpt-5',
  instructions: 'Be helpful',
  voice: 'alloy',
  turnDetection: true,
  threshold: 0.5,
  prefixPadding: 300,
  silenceDuration: 500,
  transcriptModel: 'whisper-1',
  maxTokens: 300,
}

describe('GitHubModelsAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('emits assistant transcript on successful chat completion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ text: 'Paris is the capital of France.' }),
    } as Response)

    const events: AgentEvent[] = []
    const adapter = new GitHubModelsAdapter(baseConfig, (event) => events.push(event))

    await adapter.connect()
    adapter.sendText('What is the capital of France?')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(events.some((event) => event.type === 'session_started')).toBe(true)
    expect(events.some((event) => event.type === 'assistant_transcript_done' && event.text.includes('Paris'))).toBe(true)
  })

  test('rejects microphone usage with a clear error', async () => {
    const adapter = new GitHubModelsAdapter(baseConfig, () => {})
    await adapter.connect()
    await expect(adapter.startMicrophone()).rejects.toThrow('Microphone is not supported for GitHub Models yet')
  })

  test('emits error for empty model response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({}),
    } as Response)

    const events: AgentEvent[] = []
    const adapter = new GitHubModelsAdapter(baseConfig, (event) => events.push(event))

    await adapter.connect()
    adapter.sendText('Hello')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(events.some((event) => event.type === 'error' && event.message.includes('Empty response'))).toBe(true)
  })
})
