import { OpenCTOError, type OpenCTOClientOptions, type OpenCTORequestOptions } from './types.js'

function trimTrailingSlashes(value: string): string {
  let end = value.length
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1
  }
  return value.slice(0, end)
}

export class OpenCTOClient {
  private readonly baseUrl: string
  private readonly token?: string
  private readonly headers: Record<string, string>
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(options: OpenCTOClientOptions) {
    this.baseUrl = trimTrailingSlashes(options.baseUrl)
    this.token = options.token
    this.headers = options.headers ?? {}
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? 20_000
  }

  async request<T>(path: string, options: OpenCTORequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const method = options.method ?? 'GET'
    const headers: Record<string, string> = {
      ...this.headers,
      ...(options.headers ?? {}),
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    if (options.traceId) {
      headers['x-opencto-trace-id'] = options.traceId
    }

    let body: BodyInit | undefined
    if (options.body !== undefined) {
      headers['content-type'] = headers['content-type'] ?? 'application/json'
      body = JSON.stringify(options.body)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      })

      const contentType = response.headers.get('content-type') ?? ''
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : await response.text().catch(() => '')

      if (!response.ok) {
        const errorPayload = (typeof payload === 'object' && payload) ? payload as Record<string, unknown> : {}
        const message = String(errorPayload.error ?? `Request failed (${response.status})`)
        const code = String(errorPayload.code ?? 'OPENCTO_REQUEST_FAILED')
        throw new OpenCTOError(message, response.status, code, errorPayload)
      }

      return payload as T
    } finally {
      clearTimeout(timeout)
    }
  }
}
