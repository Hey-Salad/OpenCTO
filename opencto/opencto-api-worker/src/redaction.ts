const SECRET_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /\bsk-[A-Za-z0-9_-]{12,}\b/g, replacement: '[REDACTED_OPENAI_KEY]' },
  { regex: /\bghp_[A-Za-z0-9]{20,}\b/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  { regex: /\bhf_[A-Za-z0-9]{12,}\b/g, replacement: '[REDACTED_HF_TOKEN]' },
  { regex: /Bearer\s+[A-Za-z0-9._~+/-]{10,}/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
  {
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY_BLOCK]',
  },
]

export function redactSecrets(text: string): string {
  let redacted = text
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern.regex, pattern.replacement)
  }
  return redacted
}

export function redactUnknown(input: unknown): unknown {
  if (typeof input === 'string') return redactSecrets(input)
  if (Array.isArray(input)) return input.map((item) => redactUnknown(item))
  if (input && typeof input === 'object') {
    const next: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      next[key] = redactUnknown(value)
    }
    return next
  }
  return input
}
