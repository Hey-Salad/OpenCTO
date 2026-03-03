import type { ApiErrorShape, OpenCtoError } from '../types/common'

export function codeFromStatus(status: number): string {
  if (status === 400) return 'BAD_REQUEST'
  if (status === 401) return 'AUTH_REQUIRED'
  if (status === 403) return 'ACCESS_DENIED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 422) return 'VALIDATION_FAILED'
  if (status >= 500) return 'UPSTREAM_FAILURE'
  return 'REQUEST_FAILED'
}

export function createOpenCtoError(
  message: string,
  input?: { code?: string; status?: number; details?: unknown },
): OpenCtoError {
  const err = new Error(message) as OpenCtoError
  err.code = input?.code ?? 'REQUEST_FAILED'
  err.status = input?.status
  err.details = input?.details
  return err
}

export function normalizeError(input: unknown, fallbackMessage: string): OpenCtoError {
  if (input instanceof Error) {
    const anyErr = input as Partial<OpenCtoError>
    return createOpenCtoError(input.message || fallbackMessage, {
      code: anyErr.code,
      status: anyErr.status,
      details: anyErr.details,
    })
  }

  return createOpenCtoError(fallbackMessage)
}

export function parseApiErrorBody(body: unknown): { message?: string; code?: string; details?: unknown } {
  const candidate = (body && typeof body === 'object') ? body as ApiErrorShape & { details?: unknown } : {}
  const message = typeof candidate.error === 'string' && candidate.error.trim() ? candidate.error : undefined
  const code = typeof candidate.code === 'string' && candidate.code.trim() ? candidate.code : undefined
  const details = 'details' in candidate ? candidate.details : undefined
  return { message, code, details }
}
