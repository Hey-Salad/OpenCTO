import { codeFromStatus, createOpenCtoError, parseApiErrorBody } from './errors'
import type { FetchLike } from '../types/common'

export interface HttpClientOptions {
  baseUrl: string
  getToken?: () => string | null | Promise<string | null>
  fetchImpl?: FetchLike
  defaultHeaders?: Record<string, string>
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function toUrl(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`
}

async function resolveHeaders(
  options: HttpClientOptions,
  initHeaders?: HeadersInit,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(options.defaultHeaders ?? {}),
  }

  if (initHeaders) {
    const extra = new Headers(initHeaders)
    extra.forEach((value, key) => {
      headers[key] = value
    })
  }

  const token = await options.getToken?.()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

export function createHttpClient(options: HttpClientOptions) {
  const fetchImpl: FetchLike = options.fetchImpl ?? globalThis.fetch.bind(globalThis)

  async function request<T>(path: string, init?: RequestInit, fallbackMessage?: string): Promise<T> {
    const url = toUrl(options.baseUrl, path)
    const response = await fetchImpl(url, {
      ...init,
      headers: await resolveHeaders(options, init?.headers),
    })

    if (!response.ok) {
      let parsed: { message?: string; code?: string; details?: unknown } = {}
      try {
        parsed = parseApiErrorBody(await response.json())
      } catch {
        // ignore parse errors; fallback message below
      }

      throw createOpenCtoError(
        parsed.message ?? `${fallbackMessage ?? 'Request failed'} (${response.status})`,
        {
          code: parsed.code ?? codeFromStatus(response.status),
          status: response.status,
          details: parsed.details,
        },
      )
    }

    return (await response.json()) as T
  }

  return {
    get: <T>(path: string, fallbackMessage?: string) => request<T>(path, { method: 'GET' }, fallbackMessage),
    post: <T>(path: string, body?: unknown, fallbackMessage?: string, init?: RequestInit) => request<T>(
      path,
      {
        ...init,
        method: 'POST',
        body: body === undefined ? init?.body : JSON.stringify(body),
      },
      fallbackMessage,
    ),
    delete: <T>(path: string, fallbackMessage?: string, init?: RequestInit) => request<T>(
      path,
      {
        ...init,
        method: 'DELETE',
      },
      fallbackMessage,
    ),
    request,
  }
}
