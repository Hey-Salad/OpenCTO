import {
  extractGitHubModelId,
  executeToolProxy,
  isGitHubModel,
  isGeminiLiveModel,
  isGeminiModel,
  isOpenAIRealtimeModel,
  normalizeGeminiModel,
  parseMessagePayload,
  proxyGet,
  selectSupportedGoogleLiveModel,
} from './shared'

describe('realtime shared helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('detects and normalizes gemini models', () => {
    expect(isGeminiModel('gemini-2.0-flash-live-001')).toBe(true)
    expect(isGeminiModel('gpt-4o-realtime-preview')).toBe(false)
    expect(isGeminiLiveModel('gemini-2.0-flash-live-001')).toBe(true)
    expect(isGeminiLiveModel('gemini-2.5-pro-preview')).toBe(false)
    expect(isOpenAIRealtimeModel('gpt-realtime-1.5')).toBe(true)
    expect(isOpenAIRealtimeModel('gpt-4.1')).toBe(false)
    expect(normalizeGeminiModel('gemini-2.0-flash-live-001')).toBe('models/gemini-2.0-flash-live-001')
    expect(normalizeGeminiModel('models/gemini-2.0-flash-live-001')).toBe('models/gemini-2.0-flash-live-001')
    expect(selectSupportedGoogleLiveModel('gemini-2.5-flash-native-audio-preview-09-2025')).toBe(
      'gemini-2.5-flash-native-audio-preview-09-2025',
    )
    expect(selectSupportedGoogleLiveModel('gemini-2.0-flash-live-001')).toBe(
      'gemini-2.5-flash-native-audio-preview-12-2025',
    )
  })

  test('detects and normalizes github models', () => {
    expect(isGitHubModel('github/openai/gpt-5')).toBe(true)
    expect(isGitHubModel('gpt-4o-realtime-preview')).toBe(false)
    expect(extractGitHubModelId('github/openai/gpt-5')).toBe('openai/gpt-5')
  })

  test('parses string/blob/arraybuffer payloads', async () => {
    const json = JSON.stringify({ type: 'ok', value: 1 })
    expect(await parseMessagePayload(json)).toEqual({ type: 'ok', value: 1 })
    expect(await parseMessagePayload({ text: async () => json })).toEqual({ type: 'ok', value: 1 })

    const bytes = new TextEncoder().encode(json)
    expect(await parseMessagePayload(bytes.buffer)).toEqual({ type: 'ok', value: 1 })
  })

  test('returns null for unsupported payload shape', async () => {
    expect(await parseMessagePayload(42)).toBeNull()
  })

  test('proxyGet returns structured error payload on non-2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'upstream unavailable',
    } as Response)

    const output = await proxyGet('/api/v1/cto/openai/models')
    expect(output).toContain('HTTP 503')
    expect(output).toContain('upstream unavailable')
  })

  test('executeToolProxy rejects unknown tools safely', async () => {
    const output = await executeToolProxy('does_not_exist', {})
    expect(output).toContain('Unknown tool: does_not_exist')
  })
})
