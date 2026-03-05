# @heysalad/opencto

OpenCTO JavaScript SDK for auth, chats, runs, realtime, marketplace, agents, and trace context propagation.

## Install

```bash
npm install @heysalad/opencto
```

## Quick Start

```ts
import { createOpenCTO } from '@heysalad/opencto'

const sdk = createOpenCTO({
  baseUrl: 'https://api.opencto.works',
  token: process.env.OPENCTO_TOKEN,
})

const account = await sdk.marketplace.createConnectedAccount({
  businessName: 'My Agent Studio',
  country: 'US',
})

const onboarding = await sdk.marketplace.createConnectedAccountOnboardingLink(account.stripeAccountId)
console.log(onboarding.onboardingUrl)
```

## Marketplace APIs

- `marketplace.createConnectedAccount(input)`
- `marketplace.createConnectedAccountOnboardingLink(accountId)`
- `marketplace.createRentalCheckoutSession(input)`
- `marketplace.listMyRentals()`

## Agent Identity APIs

- `agents.listIdentities()`
- `agents.createIdentity(input)`
- `agents.rotateIdentityKey(identityId)`
- `agents.revokeIdentity(identityId)`

## Trace Helpers

```ts
import { createTraceHeaders } from '@heysalad/opencto'

const traceHeaders = createTraceHeaders({
  traceparent: '00-...-...-01',
  traceId: 'trace-abc',
  sessionId: 'session-123',
})
```

## Release

```bash
npm run build
npm publish --access public
```
