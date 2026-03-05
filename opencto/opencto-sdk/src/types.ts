export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface OpenCTOClientOptions {
  baseUrl: string
  token?: string
  headers?: Record<string, string>
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export interface OpenCTORequestOptions {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
  traceId?: string
}

export interface OpenCTOErrorPayload {
  error?: string
  code?: string
  status?: number
  details?: Record<string, unknown>
}

export class OpenCTOError extends Error {
  status: number
  code: string
  payload: OpenCTOErrorPayload

  constructor(message: string, status: number, code: string, payload: OpenCTOErrorPayload) {
    super(message)
    this.name = 'OpenCTOError'
    this.status = status
    this.code = code
    this.payload = payload
  }
}

export interface ConnectedAccountResponse {
  workspaceId: string
  stripeAccountId: string
  onboardingComplete?: boolean
  alreadyExists?: boolean
}

export interface OnboardingLinkResponse {
  stripeAccountId: string
  onboardingUrl: string
  expiresAt: number
}

export interface RentalCheckoutResponse {
  contractId: string
  checkoutSessionId: string
  checkoutUrl: string | null
  amountCents: number
  platformFeeCents: number
  currency: string
}

export interface AgentRentalContract {
  id: string
  renterWorkspaceId: string
  providerWorkspaceId: string
  providerStripeAccountId: string
  agentSlug: string
  description: string | null
  amountCents: number
  platformFeeCents: number
  currency: string
  status: string
  checkoutSessionId: string | null
  paymentIntentId: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentIdentity {
  id: string
  workspaceId: string
  name: string
  role: 'worker' | 'orchestrator' | 'reviewer' | 'custom'
  scopes: string[]
  status: 'active' | 'revoked'
  createdAt: string
  updatedAt: string
}

export interface TraceContextInput {
  traceparent?: string
  tracestate?: string
  traceId?: string
  sessionId?: string
}

export interface TraceContext {
  traceparent?: string
  tracestate?: string
  traceId?: string
  sessionId?: string
}
