import { describe, expect, it } from 'vitest'
import { redactSecrets } from '../redaction'

describe('redactSecrets', () => {
  it('redacts common token formats', () => {
    const value = [
      'token sk-abcdefghijklmnopqrstuvwxyz1234',
      'ghp_012345678901234567890123456789012345',
      'hf_abcdefghijklmno123456789',
      'Bearer abcdefghijklmnopqrstuvwxyz.1234567890',
    ].join(' | ')

    const redacted = redactSecrets(value)

    expect(redacted).not.toContain('sk-abcdefghijklmnopqrstuvwxyz1234')
    expect(redacted).not.toContain('ghp_012345678901234567890123456789012345')
    expect(redacted).not.toContain('hf_abcdefghijklmno123456789')
    expect(redacted).not.toContain('Bearer abcdefghijklmnopqrstuvwxyz.1234567890')
    expect(redacted).toContain('[REDACTED_OPENAI_KEY]')
    expect(redacted).toContain('[REDACTED_GITHUB_TOKEN]')
    expect(redacted).toContain('[REDACTED_HF_TOKEN]')
    expect(redacted).toContain('Bearer [REDACTED_TOKEN]')
  })

  it('redacts private key blocks', () => {
    const value = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'
    const redacted = redactSecrets(value)

    expect(redacted).toBe('[REDACTED_PRIVATE_KEY_BLOCK]')
  })
})
