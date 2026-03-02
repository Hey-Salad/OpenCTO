import type { AgentEvent, CTOAgentConfig } from './realtime/shared'

const openaiCalls = {
  connect: vi.fn<() => Promise<void>>(),
  disconnect: vi.fn(),
  startMicrophone: vi.fn<() => Promise<void>>(),
  stopMicrophone: vi.fn(),
  sendText: vi.fn<(text: string) => void>(),
}

const googleCalls = {
  connect: vi.fn<() => Promise<void>>(),
  disconnect: vi.fn(),
  startMicrophone: vi.fn<() => Promise<void>>(),
  stopMicrophone: vi.fn(),
  sendText: vi.fn<(text: string) => void>(),
}

const githubCalls = {
  connect: vi.fn<() => Promise<void>>(),
  disconnect: vi.fn(),
  startMicrophone: vi.fn<() => Promise<void>>(),
  stopMicrophone: vi.fn(),
  sendText: vi.fn<(text: string) => void>(),
}

vi.mock('./realtime/openaiAdapter', () => ({
  OpenAIRealtimeAdapter: class {
    connect = openaiCalls.connect
    disconnect = openaiCalls.disconnect
    startMicrophone = openaiCalls.startMicrophone
    stopMicrophone = openaiCalls.stopMicrophone
    sendText = openaiCalls.sendText
  },
}))

vi.mock('./realtime/googleAdapter', () => ({
  GoogleLiveAdapter: class {
    connect = googleCalls.connect
    disconnect = googleCalls.disconnect
    startMicrophone = googleCalls.startMicrophone
    stopMicrophone = googleCalls.stopMicrophone
    sendText = googleCalls.sendText
  },
}))

vi.mock('./realtime/githubAdapter', () => ({
  GitHubModelsAdapter: class {
    connect = githubCalls.connect
    disconnect = githubCalls.disconnect
    startMicrophone = githubCalls.startMicrophone
    stopMicrophone = githubCalls.stopMicrophone
    sendText = githubCalls.sendText
  },
}))

const baseConfig: CTOAgentConfig = {
  model: 'gpt-4o-realtime-preview',
  instructions: 'be helpful',
  voice: 'alloy',
  turnDetection: true,
  threshold: 0.5,
  prefixPadding: 300,
  silenceDuration: 500,
  transcriptModel: 'whisper-1',
  maxTokens: 512,
}

const onEvent = vi.fn<(event: AgentEvent) => void>()

describe('CTOAgentSession adapter routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    openaiCalls.connect.mockResolvedValue()
    openaiCalls.startMicrophone.mockResolvedValue()
    googleCalls.connect.mockResolvedValue()
    googleCalls.startMicrophone.mockResolvedValue()
    githubCalls.connect.mockResolvedValue()
    githubCalls.startMicrophone.mockResolvedValue()
  })

  test('uses OpenAI adapter for non-gemini models and delegates methods', async () => {
    const { CTOAgentSession } = await import('./ctoAgent')
    const session = new CTOAgentSession('/token', baseConfig, onEvent)

    await session.connect()
    await session.startMicrophone()
    session.sendText('hello')
    session.stopMicrophone()
    session.disconnect()

    expect(openaiCalls.connect).toHaveBeenCalledTimes(1)
    expect(openaiCalls.startMicrophone).toHaveBeenCalledTimes(1)
    expect(openaiCalls.sendText).toHaveBeenCalledWith('hello')
    expect(openaiCalls.stopMicrophone).toHaveBeenCalledTimes(1)
    expect(openaiCalls.disconnect).toHaveBeenCalledTimes(1)
    expect(googleCalls.connect).not.toHaveBeenCalled()
  })

  test('uses Google adapter for gemini models', async () => {
    const { CTOAgentSession } = await import('./ctoAgent')
    const session = new CTOAgentSession('/token', { ...baseConfig, model: 'gemini-2.0-flash-live-001' }, onEvent)

    await session.connect()
    session.disconnect()

    expect(googleCalls.connect).toHaveBeenCalledTimes(1)
    expect(googleCalls.disconnect).toHaveBeenCalledTimes(1)
    expect(openaiCalls.connect).not.toHaveBeenCalled()
  })

  test('clears adapter on connect failure so retries work', async () => {
    const { CTOAgentSession } = await import('./ctoAgent')
    const session = new CTOAgentSession('/token', baseConfig, onEvent)

    openaiCalls.connect.mockRejectedValueOnce(new Error('boot failed'))
    await expect(session.connect()).rejects.toThrow('boot failed')

    openaiCalls.connect.mockResolvedValueOnce()
    await session.connect()

    expect(openaiCalls.connect).toHaveBeenCalledTimes(2)
  })

  test('uses GitHub adapter for github/* models', async () => {
    const { CTOAgentSession } = await import('./ctoAgent')
    const session = new CTOAgentSession('/token', { ...baseConfig, model: 'github/openai/gpt-5' }, onEvent)

    await session.connect()
    session.sendText('status?')
    session.disconnect()

    expect(githubCalls.connect).toHaveBeenCalledTimes(1)
    expect(githubCalls.sendText).toHaveBeenCalledWith('status?')
    expect(githubCalls.disconnect).toHaveBeenCalledTimes(1)
    expect(openaiCalls.connect).not.toHaveBeenCalled()
    expect(googleCalls.connect).not.toHaveBeenCalled()
  })

  test('uses supervisor text adapter for non-realtime non-gemini models', async () => {
    const { CTOAgentSession } = await import('./ctoAgent')
    const session = new CTOAgentSession('/token', { ...baseConfig, model: 'gpt-4.1' }, onEvent)

    await session.connect()
    session.sendText('plan this migration')
    session.disconnect()

    expect(githubCalls.connect).toHaveBeenCalledTimes(1)
    expect(githubCalls.sendText).toHaveBeenCalledWith('plan this migration')
    expect(openaiCalls.connect).not.toHaveBeenCalled()
    expect(googleCalls.connect).not.toHaveBeenCalled()
  })

  test('fails fast when microphone starts before connect', async () => {
    const { CTOAgentSession } = await import('./ctoAgent')
    const session = new CTOAgentSession('/token', baseConfig, onEvent)

    await expect(session.startMicrophone()).rejects.toThrow('Session is not connected')
  })
})
