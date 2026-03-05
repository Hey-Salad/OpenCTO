import { OpenCTOClient } from '../client.js'
import type { AgentIdentity } from '../types.js'

export interface CreateAgentIdentityInput {
  name: string
  role?: AgentIdentity['role']
  scopes?: string[]
}

export interface CreateAgentIdentityResult {
  identity: AgentIdentity
  apiKey?: string
}

export class AgentsClient {
  constructor(private readonly client: OpenCTOClient) {}

  listIdentities(): Promise<{ identities: AgentIdentity[] }> {
    return this.client.request('/api/v1/agents/identities')
  }

  createIdentity(input: CreateAgentIdentityInput): Promise<CreateAgentIdentityResult> {
    return this.client.request('/api/v1/agents/identities', {
      method: 'POST',
      body: input,
    })
  }

  rotateIdentityKey(identityId: string): Promise<{ identityId: string; apiKey: string }> {
    return this.client.request(`/api/v1/agents/identities/${encodeURIComponent(identityId)}/rotate-key`, {
      method: 'POST',
    })
  }

  revokeIdentity(identityId: string): Promise<{ identityId: string; status: 'revoked' }> {
    return this.client.request(`/api/v1/agents/identities/${encodeURIComponent(identityId)}/revoke`, {
      method: 'POST',
    })
  }
}
