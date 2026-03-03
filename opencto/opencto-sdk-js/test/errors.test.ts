import { describe, expect, it } from 'vitest'
import { codeFromStatus, normalizeError } from '../src/core/errors'

describe('errors', () => {
  it('maps status to code', () => {
    expect(codeFromStatus(401)).toBe('AUTH_REQUIRED')
    expect(codeFromStatus(500)).toBe('UPSTREAM_FAILURE')
  })

  it('normalizes unknown inputs', () => {
    const err = normalizeError('oops', 'fallback')
    expect(err.code).toBe('REQUEST_FAILED')
    expect(err.message).toBe('fallback')
  })
})
