export interface CTOAgentConfig {
  model: string
  reasoningModel?: string
  instructions: string
  voice: string
  turnDetection: boolean
  threshold: number
  prefixPadding: number
  silenceDuration: number
  transcriptModel: string
  maxTokens: number
}

export type AgentEvent =
  | { type: 'session_started' }
  | { type: 'session_ended' }
  | { type: 'user_transcript'; text: string }
  | { type: 'assistant_transcript_done'; text: string }
  | { type: 'tool_start'; toolName: string }
  | { type: 'tool_end'; toolName: string }
  | { type: 'error'; message: string }

export type FunctionTool = {
  type: 'function'
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: 'string'; description: string }>
    required: string[]
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const AUTH_HEADER = { Authorization: 'Bearer demo-token' }

export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

export const CONNECT_TIMEOUT_MS = 10_000

export const TOOLS: FunctionTool[] = [
  {
    type: 'function',
    name: 'list_vercel_projects',
    description: 'List all Vercel projects in this account',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'list_vercel_deployments',
    description: 'List the most recent deployments for a Vercel project',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Vercel project name or ID' },
      },
      required: ['projectId'],
    },
  },
  {
    type: 'function',
    name: 'get_vercel_deployment',
    description: 'Get details and status of a specific Vercel deployment',
    parameters: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string', description: 'Vercel deployment ID (dpl_...)' },
      },
      required: ['deploymentId'],
    },
  },
  {
    type: 'function',
    name: 'list_cloudflare_workers',
    description: 'List all Cloudflare Workers scripts in the account',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'list_cloudflare_pages',
    description: 'List all Cloudflare Pages projects',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'get_cloudflare_worker_usage',
    description: 'Get CPU time and request metrics for a specific Cloudflare Worker',
    parameters: {
      type: 'object',
      properties: {
        scriptName: { type: 'string', description: 'Cloudflare Worker script name' },
      },
      required: ['scriptName'],
    },
  },
  {
    type: 'function',
    name: 'list_openai_models',
    description: 'List all available OpenAI models',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function',
    name: 'get_openai_usage',
    description: 'Get OpenAI API usage and token costs for a date range',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD' },
      },
      required: ['startDate', 'endDate'],
    },
  },
]

export const PCM_WORKLET_CODE = `
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

export function isGeminiModel(model: string): boolean {
  return model.toLowerCase().includes('gemini')
}

export function isGeminiLiveModel(model: string): boolean {
  const lower = model.toLowerCase()
  return lower.includes('gemini') && (lower.includes('live') || lower.includes('native-audio'))
}

export function isOpenAIRealtimeModel(model: string): boolean {
  return model.toLowerCase().includes('realtime')
}

export function isGitHubModel(model: string): boolean {
  return model.toLowerCase().startsWith('github/')
}

export function extractGitHubModelId(model: string): string {
  return model.replace(/^github\//i, '')
}

export function normalizeGeminiModel(model: string): string {
  if (model.startsWith('models/')) return model
  return `models/${model}`
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

export async function parseMessagePayload(data: unknown): Promise<Record<string, unknown> | null> {
  if (typeof data === 'string') {
    return JSON.parse(data) as Record<string, unknown>
  }

  const blobLike = data as { text?: () => Promise<string>; arrayBuffer?: () => Promise<ArrayBuffer> } | null
  if (blobLike && typeof blobLike === 'object' && (typeof blobLike.text === 'function' || typeof blobLike.arrayBuffer === 'function')) {
    let text = ''
    if (typeof blobLike.text === 'function') {
      text = await blobLike.text()
    } else if (typeof blobLike.arrayBuffer === 'function') {
      const bytes = new Uint8Array(await blobLike.arrayBuffer())
      text = new TextDecoder().decode(bytes)
    } else {
      return null
    }
    return JSON.parse(text) as Record<string, unknown>
  }

  if (
    data instanceof ArrayBuffer
    || Object.prototype.toString.call(data) === '[object ArrayBuffer]'
    || ArrayBuffer.isView(data)
  ) {
    const bytes = ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data as ArrayBuffer)
    const text = new TextDecoder().decode(bytes)
    return JSON.parse(text) as Record<string, unknown>
  }

  return null
}

export async function proxyGet(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, { headers: AUTH_HEADER })
  const text = await res.text()
  return res.ok ? text : JSON.stringify({ error: `HTTP ${res.status}`, details: text })
}

export async function executeToolProxy(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'list_vercel_projects':
      return proxyGet('/api/v1/cto/vercel/projects')
    case 'list_vercel_deployments':
      return proxyGet(`/api/v1/cto/vercel/projects/${encodeURIComponent(String(args.projectId ?? ''))}/deployments`)
    case 'get_vercel_deployment':
      return proxyGet(`/api/v1/cto/vercel/deployments/${encodeURIComponent(String(args.deploymentId ?? ''))}`)
    case 'list_cloudflare_workers':
      return proxyGet('/api/v1/cto/cloudflare/workers')
    case 'list_cloudflare_pages':
      return proxyGet('/api/v1/cto/cloudflare/pages')
    case 'get_cloudflare_worker_usage':
      return proxyGet(`/api/v1/cto/cloudflare/workers/${encodeURIComponent(String(args.scriptName ?? ''))}/usage`)
    case 'list_openai_models':
      return proxyGet('/api/v1/cto/openai/models')
    case 'get_openai_usage':
      return proxyGet(
        `/api/v1/cto/openai/usage?start=${encodeURIComponent(String(args.startDate ?? ''))}&end=${encodeURIComponent(String(args.endDate ?? ''))}`,
      )
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

export function pickString(obj: Record<string, unknown>, camel: string, snake: string): string | undefined {
  return (obj[camel] as string | undefined) ?? (obj[snake] as string | undefined)
}
