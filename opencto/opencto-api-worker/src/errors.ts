// Unified error handling for OpenCTO API
// SECURITY: Never log or expose secrets, tokens, or sensitive data

import type { ApiError } from './types'

export class ApiException extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiException'
  }
}

export class UnauthorizedException extends ApiException {
  constructor(message = 'Unauthorized', details?: Record<string, unknown>) {
    super(401, 'UNAUTHORIZED', message, details)
    this.name = 'UnauthorizedException'
  }
}

export class ForbiddenException extends ApiException {
  constructor(message = 'Forbidden', details?: Record<string, unknown>) {
    super(403, 'FORBIDDEN', message, details)
    this.name = 'ForbiddenException'
  }
}

export class NotFoundException extends ApiException {
  constructor(message = 'Not found', details?: Record<string, unknown>) {
    super(404, 'NOT_FOUND', message, details)
    this.name = 'NotFoundException'
  }
}

export class BadRequestException extends ApiException {
  constructor(message = 'Bad request', details?: Record<string, unknown>) {
    super(400, 'BAD_REQUEST', message, details)
    this.name = 'BadRequestException'
  }
}

export class ConflictException extends ApiException {
  constructor(message = 'Conflict', details?: Record<string, unknown>) {
    super(409, 'CONFLICT', message, details)
    this.name = 'ConflictException'
  }
}

export class TooManyRequestsException extends ApiException {
  constructor(message = 'Too many requests', code = 'QUOTA_EXCEEDED', details?: Record<string, unknown>) {
    super(429, code, message, details)
    this.name = 'TooManyRequestsException'
  }
}

export class NotImplementedException extends ApiException {
  constructor(message = 'Not implemented', details?: Record<string, unknown>) {
    super(501, 'NOT_IMPLEMENTED', message, details)
    this.name = 'NotImplementedException'
  }
}

export class InternalServerException extends ApiException {
  constructor(message = 'Internal server error', details?: Record<string, unknown>) {
    super(500, 'INTERNAL_SERVER_ERROR', message, details)
    this.name = 'InternalServerException'
  }
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
}

export function toJsonResponse(error: unknown): Response {
  // Handle known API exceptions
  if (error instanceof ApiException) {
    const body: ApiError = {
      error: error.message,
      code: error.code,
      status: error.statusCode,
      details: error.details,
    }
    return new Response(JSON.stringify(body), {
      status: error.statusCode,
      headers: CORS_HEADERS,
    })
  }

  // Log unexpected errors (but never log secrets!)
  console.error('Unexpected error:', error instanceof Error ? error.message : 'Unknown error')

  // Return generic error to client
  const body: ApiError = {
    error: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
    status: 500,
    details: error instanceof Error
      ? { message: sanitizeError(error) }
      : { message: 'Unknown error' },
  }
  return new Response(JSON.stringify(body), {
    status: 500,
    headers: CORS_HEADERS,
  })
}

export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS })
}

// Safe error sanitization - never expose sensitive data
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Remove any potential sensitive data from error messages
    const message = error.message
      .replace(/key[_-]?[a-zA-Z0-9]{10,}/gi, '[REDACTED_KEY]')
      .replace(/token[_-]?[a-zA-Z0-9]{10,}/gi, '[REDACTED_TOKEN]')
      .replace(/secret[_-]?[a-zA-Z0-9]{10,}/gi, '[REDACTED_SECRET]')
    return message
  }
  return 'Unknown error'
}
