import type { TraceContext } from './types'

function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2))
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length)
}

function normalizeTraceId(input: string | null): string | null {
  if (!input) return null
  const normalized = input.trim().toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(normalized) || /^0+$/.test(normalized)) return null
  return normalized
}

function normalizeSpanId(input: string | null): string | null {
  if (!input) return null
  const normalized = input.trim().toLowerCase()
  if (!/^[0-9a-f]{16}$/.test(normalized) || /^0+$/.test(normalized)) return null
  return normalized
}

function extractTraceIdFromTraceparent(traceparent: string | null): string | null {
  if (!traceparent) return null
  const parts = traceparent.trim().split('-')
  if (parts.length !== 4) return null
  const traceId = normalizeTraceId(parts[1] ?? null)
  const spanId = normalizeSpanId(parts[2] ?? null)
  if (!traceId || !spanId) return null
  return traceId
}

export function extractTraceContext(request: Request): TraceContext {
  const traceparentHeader = request.headers.get('traceparent')
  const explicitTraceId = normalizeTraceId(request.headers.get('x-opencto-trace-id'))
  const traceId = explicitTraceId ?? extractTraceIdFromTraceparent(traceparentHeader) ?? randomHex(32)
  const traceparent = traceparentHeader?.trim() || `00-${traceId}-${randomHex(16)}-01`
  const tracestate = request.headers.get('tracestate') ?? undefined
  const sessionId = request.headers.get('x-opencto-session-id') ?? undefined

  return {
    traceId,
    traceparent,
    tracestate,
    sessionId,
  }
}

export function appendTraceHeaders(headers: Headers, traceContext: TraceContext): void {
  headers.set('x-opencto-trace-id', traceContext.traceId)
  headers.set('traceparent', traceContext.traceparent)
  if (traceContext.tracestate) {
    headers.set('tracestate', traceContext.tracestate)
  }
  if (traceContext.sessionId) {
    headers.set('x-opencto-session-id', traceContext.sessionId)
  }
}

export function withTraceResponseHeaders(response: Response, traceContext: TraceContext): Response {
  const headers = new Headers(response.headers)
  appendTraceHeaders(headers, traceContext)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function tracePropagationHeaders(traceContext: TraceContext): Record<string, string> {
  const headers: Record<string, string> = {
    'x-opencto-trace-id': traceContext.traceId,
    traceparent: traceContext.traceparent,
  }
  if (traceContext.tracestate) headers.tracestate = traceContext.tracestate
  if (traceContext.sessionId) headers['x-opencto-session-id'] = traceContext.sessionId
  return headers
}
