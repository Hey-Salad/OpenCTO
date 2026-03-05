import { OpenCTOClient } from '../client.js'
import type {
  AgentRentalContract,
  ConnectedAccountResponse,
  OnboardingLinkResponse,
  RentalCheckoutResponse,
} from '../types.js'

export interface CreateConnectedAccountInput {
  businessName?: string
  country?: string
}

export interface CreateRentalCheckoutInput {
  providerWorkspaceId: string
  providerStripeAccountId: string
  agentSlug: string
  description?: string
  amountUsd: number
  currency?: string
  platformFeePercent?: number
}

export class MarketplaceClient {
  constructor(private readonly client: OpenCTOClient) {}

  createConnectedAccount(input: CreateConnectedAccountInput = {}): Promise<ConnectedAccountResponse> {
    return this.client.request('/api/v1/marketplace/connect/accounts', {
      method: 'POST',
      body: input,
    })
  }

  createConnectedAccountOnboardingLink(accountId: string): Promise<OnboardingLinkResponse> {
    return this.client.request(`/api/v1/marketplace/connect/accounts/${encodeURIComponent(accountId)}/onboarding-link`, {
      method: 'POST',
    })
  }

  createRentalCheckoutSession(input: CreateRentalCheckoutInput): Promise<RentalCheckoutResponse> {
    return this.client.request('/api/v1/marketplace/agent-rentals/checkout/session', {
      method: 'POST',
      body: input,
    })
  }

  async listMyRentals(): Promise<AgentRentalContract[]> {
    const response = await this.client.request<{ contracts: AgentRentalContract[] }>('/api/v1/marketplace/agent-rentals')
    return response.contracts
  }
}
