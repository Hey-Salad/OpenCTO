import type { TraceContext, TraceContextInput } from './types.js'

export function createTraceContext(input: TraceContextInput = {}): TraceContext {
  return {
    traceparent: input.traceparent,
    tracestate: input.tracestate,
    traceId: input.traceId,
    sessionId: input.sessionId,
  }
}

export function createTraceHeaders(context: TraceContextInput = {}): Record<string, string> {
  const headers: Record<string, string> = {}
  if (context.traceparent) headers.traceparent = context.traceparent
  if (context.tracestate) headers.tracestate = context.tracestate
  if (context.traceId) headers['x-opencto-trace-id'] = context.traceId
  if (context.sessionId) headers['x-opencto-session-id'] = context.sessionId
  return headers
}

export function extractTraceContextFromHeaders(headers: Headers): TraceContext {
  return {
    traceparent: headers.get('traceparent') ?? undefined,
    tracestate: headers.get('tracestate') ?? undefined,
    traceId: headers.get('x-opencto-trace-id') ?? undefined,
    sessionId: headers.get('x-opencto-session-id') ?? undefined,
  }
}
