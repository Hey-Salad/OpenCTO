export interface SafeApiError extends Error {
  code: string
  status?: number
}

function codeFromStatus(status: number): string {
  if (status === 401) return 'AUTH_REQUIRED'
  if (status === 403) return 'ACCESS_DENIED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 422) return 'VALIDATION_FAILED'
  if (status >= 500) return 'UPSTREAM_FAILURE'
  return 'REQUEST_FAILED'
}

export function normalizeApiError(input: unknown, fallbackMessage: string): SafeApiError {
  if (input instanceof Error) {
    const error = new Error(input.message || fallbackMessage) as SafeApiError
    error.code = (input as SafeApiError).code ?? 'REQUEST_FAILED'
    error.status = (input as SafeApiError).status
    return error
  }

  const error = new Error(fallbackMessage) as SafeApiError
  error.code = 'REQUEST_FAILED'
  return error
}

export async function safeFetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallbackMessage: string,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    let serverMessage: string | undefined
    let serverCode: string | undefined
    try {
      const body = await response.json() as { error?: unknown; code?: unknown }
      if (typeof body.error === 'string' && body.error.trim()) serverMessage = body.error
      if (typeof body.code === 'string' && body.code.trim()) serverCode = body.code
    } catch {
      // keep fallback message for non-json error responses
    }
    const error = new Error(serverMessage || `${fallbackMessage} (${response.status})`) as SafeApiError
    error.code = serverCode || codeFromStatus(response.status)
    error.status = response.status
    throw error
  }

  return (await response.json()) as T
}
