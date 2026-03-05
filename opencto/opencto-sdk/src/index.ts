import { OpenCTOClient } from './client.js'
import { AgentsClient } from './modules/agents.js'
import { MarketplaceClient } from './modules/marketplace.js'

export * from './types.js'
export * from './tracing.js'
export { OpenCTOClient } from './client.js'
export { MarketplaceClient } from './modules/marketplace.js'
export { AgentsClient } from './modules/agents.js'

export interface OpenCTOSDK {
  client: OpenCTOClient
  marketplace: MarketplaceClient
  agents: AgentsClient
}

export function createOpenCTO(options: ConstructorParameters<typeof OpenCTOClient>[0]): OpenCTOSDK {
  const client = new OpenCTOClient(options)
  return {
    client,
    marketplace: new MarketplaceClient(client),
    agents: new AgentsClient(client),
  }
}
