export interface ApiErrorShape {
  error?: unknown
  code?: unknown
  status?: unknown
}

export interface OpenCtoError extends Error {
  code: string
  status?: number
  details?: unknown
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
