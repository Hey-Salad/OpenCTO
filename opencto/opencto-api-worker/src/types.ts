// Shared types for OpenCTO API Worker

export interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  JWT_SECRET: string
  WEBAUTHN_RP_ID: string
  WEBAUTHN_RP_NAME: string
  ENVIRONMENT: string
  // CTO agent external API keys (set via: wrangler secret put <NAME>)
  VERCEL_TOKEN: string
  CF_API_TOKEN: string
  CF_ACCOUNT_ID: string
  GITHUB_TOKEN: string
  GITHUB_OAUTH_CLIENT_ID: string
  GITHUB_OAUTH_CLIENT_SECRET: string
  API_BASE_URL: string
  OPENCTO_AGENT_BASE_URL: string
  APP_BASE_URL: string
  CODEBASE_EXECUTOR?: DurableObjectNamespace
  CODEBASE_EXECUTION_MODE?: 'stub' | 'container'
  CODEBASE_MAX_CONCURRENT_RUNS?: string
  CODEBASE_DAILY_RUN_LIMIT?: string
  CODEBASE_RUN_DEFAULT_TIMEOUT_SECONDS?: string
  CODEBASE_RUN_MIN_TIMEOUT_SECONDS?: string
  CODEBASE_RUN_MAX_TIMEOUT_SECONDS?: string
}

export type UserRole = 'owner' | 'cto' | 'developer' | 'viewer' | 'auditor'

export interface SessionUser {
  id: string
  email: string
  displayName: string
  role: UserRole
}

export interface AuthSession {
  isAuthenticated: boolean
  trustedDevice: boolean
  mfaRequired: boolean
  user: SessionUser | null
}

export type DeviceTrustState = 'TRUSTED' | 'NEW' | 'REVOKED'

export interface TrustedDevice {
  id: string
  displayName: string
  platform: 'macos' | 'ios' | 'linux' | 'windows'
  city: string
  country: string
  lastSeenAt: string
  trustState: DeviceTrustState
}

export interface PasskeyCredential {
  id: string
  displayName: string
  deviceType: 'platform' | 'cross-platform'
  lastUsedAt: string | null
  createdAt: string
}

export interface PasskeyEnrollmentStart {
  challenge: string
  rpId: string
  userId: string
}

export interface PasskeyEnrollmentComplete {
  passkeyId: string
  verified: boolean
}

export type PlanCode = 'STARTER' | 'DEVELOPER' | 'TEAM' | 'PRO' | 'ENTERPRISE'
export type BillingInterval = 'MONTHLY' | 'YEARLY'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | string

export interface Subscription {
  id: string
  customerId: string
  planCode: PlanCode
  status: SubscriptionStatus
  interval: BillingInterval
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

export interface Invoice {
  id: string
  number: string
  createdAt: string
  amountPaidUsd: number
  currency: 'USD'
  status: 'paid' | 'open' | 'void' | 'uncollectible'
  hostedInvoiceUrl?: string
  pdfUrl?: string
}

export interface UsageSummary {
  jobsUsed: number
  jobsLimit: number | null
  workersUsed: number
  workersLimit: number | null
  usersUsed: number
  usersLimit: number | null
  codexCreditUsedUsd: number
  codexCreditLimitUsd: number | null
}

export interface Plan {
  code: PlanCode
  name: string
  description: string
  monthlyPriceUsd: number | null
  yearlyPriceUsd: number | null
  includedCodexCreditUsd: number
  highlighted?: boolean
  features: string[]
}

export type ComplianceCheckStatus = 'PASS' | 'WARN' | 'BLOCK' | 'ERROR'
export type ComplianceCheckType = 'PLAN' | 'DIFF' | 'DEPLOYMENT' | 'INCIDENT'

export interface ComplianceFinding {
  id: string
  framework: 'SOC2' | 'DORA' | 'NIS2' | 'GDPR' | 'PCI-DSS'
  reference: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  summary: string
}

export interface ComplianceCheck {
  id: string
  jobId: string
  checkType: ComplianceCheckType
  status: ComplianceCheckStatus
  score: number
  findings: ComplianceFinding[]
  checkedAt: string
}

export interface CreateComplianceCheckRequest {
  jobId: string
  checkType: ComplianceCheckType
}

export interface EvidenceExportResult {
  artifactId: string
  downloadUrl: string
  expiresAt: string
}

export interface ApiError {
  error: string
  code: string
  status?: number
  details?: Record<string, unknown>
}

export interface RequestContext {
  userId: string
  user: SessionUser
  env: Env
}

export interface ChatMessageRecord {
  id: string
  role: 'USER' | 'ASSISTANT' | 'TOOL'
  kind?: 'speech' | 'code' | 'command' | 'output' | 'artifact' | 'plan'
  text: string
  timestamp: string
  startMs: number
  endMs: number
  metadata?: Record<string, unknown>
}

export interface ChatSessionRecord {
  id: string
  userId: string
  title: string
  messages: ChatMessageRecord[]
  createdAt: string
  updatedAt: string
}

export type CodebaseRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'timed_out'
export type CodebaseRunEventLevel = 'system' | 'info' | 'warn' | 'error'

export interface CodebaseRun {
  id: string
  userId: string
  repoUrl: string
  repoFullName: string | null
  baseBranch: string
  targetBranch: string
  status: CodebaseRunStatus
  requestedCommands: string[]
  commandAllowlistVersion: string
  timeoutSeconds: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  canceledAt: string | null
  errorMessage: string | null
}

export interface CodebaseRunEvent {
  id: string
  runId: string
  seq: number
  level: CodebaseRunEventLevel
  eventType: string
  message: string
  payload: Record<string, unknown> | null
  createdAt: string
}

export interface CodebaseRunArtifact {
  id: string
  runId: string
  kind: string
  path: string
  sizeBytes: number | null
  sha256: string | null
  url: string | null
  expiresAt: string | null
  createdAt: string
}
