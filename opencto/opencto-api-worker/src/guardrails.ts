import { ForbiddenException } from './errors'

type GuardrailCode =
  | 'PROMPT_INJECTION'
  | 'SECRET_EXFIL_ATTEMPT'
  | 'SCAM_SOCIAL_ENGINEERING'
  | 'UNSAFE_REPO_URL'

interface GuardrailDecision {
  blocked: boolean
  codes: GuardrailCode[]
  matchedSignals: string[]
}

const INJECTION_SIGNALS: Array<{ signal: string; pattern: RegExp }> = [
  { signal: 'override_instructions', pattern: /\b(ignore|bypass|override)\b.{0,40}\b(previous|above|system|developer)\b/i },
  { signal: 'reveal_system_prompt', pattern: /\b(show|reveal|print|leak)\b.{0,40}\b(system prompt|developer message|hidden instructions?)\b/i },
  { signal: 'policy_evasion', pattern: /\b(do not follow|disable)\b.{0,40}\b(safety|policy|guardrails?)\b/i },
]

const SECRET_SIGNALS: Array<{ signal: string; pattern: RegExp }> = [
  { signal: 'request_api_key', pattern: /\b(openai|api|github|cloudflare|jwt)\b.{0,25}\b(key|token|secret)\b/i },
  { signal: 'request_env_dump', pattern: /\b(print|dump|cat|show)\b.{0,25}\b(\.env|environment variables?|secrets?)\b/i },
  { signal: 'request_private_keys', pattern: /\b(seed phrase|private key|ssh key|wallet key)\b/i },
]

const SCAM_SIGNALS: Array<{ signal: string; pattern: RegExp }> = [
  { signal: 'urgent_transfer', pattern: /\b(urgent|immediately|right now)\b.{0,60}\b(transfer|wire|send)\b.{0,30}\b(money|funds|crypto)\b/i },
  { signal: 'gift_card_payment', pattern: /\b(gift cards?|steam cards?|itunes cards?|google play cards?)\b/i },
  { signal: 'credential_harvest', pattern: /\b(share|send)\b.{0,30}\b(password|otp|2fa code|verification code)\b/i },
]

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^\[?::1\]?$/i,
]

function evaluateSignals(text: string, signals: Array<{ signal: string; pattern: RegExp }>): string[] {
  const normalized = text.slice(0, 20000)
  return signals.filter((entry) => entry.pattern.test(normalized)).map((entry) => entry.signal)
}

function assessPromptRisk(text: string): GuardrailDecision {
  const injection = evaluateSignals(text, INJECTION_SIGNALS)
  const secrets = evaluateSignals(text, SECRET_SIGNALS)
  const scam = evaluateSignals(text, SCAM_SIGNALS)

  const codes: GuardrailCode[] = []
  if (injection.length > 0) codes.push('PROMPT_INJECTION')
  if (secrets.length > 0 && injection.length > 0) codes.push('SECRET_EXFIL_ATTEMPT')
  if (scam.length > 0) codes.push('SCAM_SOCIAL_ENGINEERING')

  return {
    blocked: codes.length > 0,
    codes,
    matchedSignals: [...injection, ...secrets, ...scam],
  }
}

function parseRepoHost(repoUrl: string): string | null {
  const value = repoUrl.trim()
  if (!value) return null

  // SSH format: git@github.com:org/repo.git
  const sshMatch = value.match(/^[^@]+@([^:]+):.+$/)
  if (sshMatch?.[1]) return sshMatch[1]

  try {
    const url = new URL(value)
    return url.hostname
  } catch {
    return null
  }
}

function isUnsafeRepoUrl(repoUrl: string): boolean {
  const value = repoUrl.trim()
  if (!value) return true
  if (value.startsWith('file://') || value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
    return true
  }

  const host = parseRepoHost(value)
  if (!host) return true
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(host))
}

export function enforcePromptGuardrails(text: string, context: string): void {
  const decision = assessPromptRisk(text)
  if (!decision.blocked) return

  throw new ForbiddenException('Request blocked by safety guardrails', {
    context,
    guardrailCodes: decision.codes,
    matchedSignals: decision.matchedSignals,
  })
}

export function enforceRepoUrlGuardrails(repoUrl: string): void {
  if (!isUnsafeRepoUrl(repoUrl)) return
  throw new ForbiddenException('repoUrl failed safety validation', {
    guardrailCodes: ['UNSAFE_REPO_URL'],
  })
}
