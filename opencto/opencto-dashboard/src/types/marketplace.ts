export interface ConnectedAccountResponse {
  workspaceId: string
  stripeAccountId: string
  onboardingComplete?: boolean
  alreadyExists?: boolean
}

export interface ConnectedAccountOnboardingLinkResponse {
  stripeAccountId: string
  onboardingUrl: string
  expiresAt: number
}

export interface CreateRentalCheckoutSessionResponse {
  contractId: string
  traceId?: string
  checkoutSessionId: string
  checkoutUrl: string | null
  amountCents: number
  platformFeeCents: number
  currency: string
}

export interface AgentRentalContract {
  id: string
  traceId?: string | null
  renterWorkspaceId: string
  providerWorkspaceId: string
  providerStripeAccountId: string
  agentSlug: string
  description?: string | null
  amountCents: number
  platformFeeCents: number
  currency: string
  status: string
  checkoutSessionId?: string | null
  paymentIntentId?: string | null
  createdAt: string
  updatedAt: string
}

export interface ListMyRentalsResponse {
  workspaceId: string
  contracts: AgentRentalContract[]
}
