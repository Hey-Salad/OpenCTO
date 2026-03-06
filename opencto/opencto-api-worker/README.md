# OpenCTO API Worker

Cloudflare Workers backend for OpenCTO platform APIs.

This service backs authentication, billing, compliance, codebase-run execution, and OpenClaw orchestration.

## What This Worker Owns

- Auth/session/device/passkey API surface
- Compliance checks and evidence export
- Stripe billing and webhooks
- Marketplace Connect onboarding and rental checkout contracts
- Codebase run orchestration (public + trusted internal dispatch)
- OpenClaw task/assignment orchestration APIs

## Project Structure

```text
opencto-api-worker/
├── src/
│   ├── index.ts
│   ├── auth.ts
│   ├── billing.ts
│   ├── compliance.ts
│   ├── entitlements.ts
│   ├── webhooks.ts
│   ├── openclawPlanner.ts
│   ├── openclawTasks.ts
│   ├── types.ts
│   └── __tests__/
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_codebase_runs.sql
│   ├── 0003_marketplace_connect.sql
│   └── 0004_openclaw_tasks.sql
├── container-runtime/codebase-executor/
├── wrangler.toml
└── package.json
```

## Prerequisites

- Node.js `>= 18`
- npm
- Cloudflare account + Wrangler CLI
- Stripe account (for billing/marketplace paths)

## Quick Start (Local)

### 1) Install

```bash
cd opencto/opencto-api-worker
npm install
```

### 2) Configure secrets

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put JWT_SECRET
wrangler secret put WEBAUTHN_RP_ID
wrangler secret put WEBAUTHN_RP_NAME
wrangler secret put OPENCTO_INTERNAL_API_TOKEN
```

Optional marketplace/runtime secrets can be added later.

### 3) Create D1 database

```bash
wrangler d1 create opencto-production
```

Update `database_id` in `wrangler.toml`.

### 4) Run migrations in order

```bash
wrangler d1 execute opencto-production --file=./migrations/0001_initial_schema.sql
wrangler d1 execute opencto-production --file=./migrations/0002_codebase_runs.sql
wrangler d1 execute opencto-production --file=./migrations/0003_marketplace_connect.sql
wrangler d1 execute opencto-production --file=./migrations/0004_openclaw_tasks.sql
```

### 5) Start dev server

```bash
npm run dev
```

## Validation Commands

Required validation for this surface:

```bash
npm run lint
npm run build
npm test
```

## API Endpoint Map

### Auth

- `GET /api/v1/auth/session`
- `GET /api/v1/auth/devices`
- `POST /api/v1/auth/devices/:id/revoke`
- `POST /api/v1/auth/passkeys/enroll/start`
- `POST /api/v1/auth/passkeys/enroll/complete`

### Compliance

- `POST /api/v1/compliance/checks`
- `GET /api/v1/compliance/checks`
- `POST /api/v1/compliance/evidence/export`

### Billing

- `GET /api/v1/billing/subscription`
- `GET /api/v1/billing/invoices`
- `POST /api/v1/billing/checkout/session`
- `POST /api/v1/billing/portal/session`
- `POST /api/v1/billing/webhooks/stripe`

### Marketplace (Connect)

- `POST /api/v1/marketplace/connect/accounts`
- `POST /api/v1/marketplace/connect/accounts/:id/onboarding-link`
- `POST /api/v1/marketplace/agent-rentals/checkout/session`
- `GET /api/v1/marketplace/agent-rentals`

Redirect behavior:

- Connect onboarding uses `MARKETPLACE_BASE_URL` (fallback `APP_BASE_URL`)
- Rental checkout success/cancel uses `MARKETPLACE_BASE_URL` (fallback `APP_BASE_URL`)

### Codebase Runs (Public)

- `POST /api/v1/codebase/runs`
- `GET /api/v1/codebase/runs/:id`
- `GET /api/v1/codebase/runs/:id/events`
- `POST /api/v1/codebase/runs/:id/cancel`
- `POST /api/v1/codebase/runs/:id/approve`
- `POST /api/v1/codebase/runs/:id/deny`

Runtime controls include allowlists, shell-chaining guards, quotas, timeout clamping, and approval gating for risky operations.

Execution mode:

- `CODEBASE_EXECUTION_MODE=stub` (default)
- `CODEBASE_EXECUTION_MODE=container` (dispatch to `CODEBASE_EXECUTOR` binding)

### Internal Codebase Run API (Trusted Workers)

- `POST /api/v1/internal/codebase/runs?dispatch=async`
- `GET /api/v1/internal/codebase/runs/:id`
- `GET /api/v1/internal/codebase/runs/:id/events`
- `POST /api/v1/internal/codebase/runs/:id/cancel`

### Internal OpenClaw API

- `POST /api/v1/internal/openclaw/tasks/plan`
- `GET /api/v1/internal/openclaw/tasks/:id`
- `GET /api/v1/internal/openclaw/assignments/next?role=&agentId=&swarm=`
- `POST /api/v1/internal/openclaw/assignments/:id/heartbeat`
- `POST /api/v1/internal/openclaw/assignments/:id/complete`
- `POST /api/v1/internal/openclaw/assignments/:id/fail`
- `POST /api/v1/internal/openclaw/assignments/:id/block`
- `POST /api/v1/internal/openclaw/agents/heartbeat`

Internal route requirements:

- send `x-opencto-internal-token: <OPENCTO_INTERNAL_API_TOKEN>`
- optional `x-opencto-service-user-email` for service attribution

## Container Runtime Contract

Codebase executor runtime lives in:

- `container-runtime/codebase-executor/Dockerfile`
- `container-runtime/codebase-executor/server.js`

Endpoint contract:

- `POST /execute` accepts run payload and returns `{ status, logs, errorMessage? }`

## Security Controls

- Unified error sanitization to avoid leaking secrets
- Stripe webhook signature verification + idempotency storage
- Server-side entitlement enforcement
- Prompt-injection and secret-exfiltration pattern guards
- Repo URL safety checks for codebase runs

## Current Gaps

Known TODO areas:

1. Complete JWT authentication implementation
2. Complete full WebAuthn verification flows
3. Add R2 evidence storage path
4. Add explicit rate limiting middleware/policy
5. Expand request logging and observability controls
6. Finalize CORS policy for all frontend surfaces

## How-To Guides

### How to bring up the API worker from scratch

1. Install dependencies: `npm install`.
2. Configure required Wrangler secrets.
3. Create D1 database and set `database_id` in `wrangler.toml`.
4. Apply migrations `0001` to `0004` in order.
5. Start dev server with `npm run dev`.
6. Hit `/health` or a simple `GET` endpoint to confirm runtime readiness.

### How to validate changes before PR

1. `npm run lint`
2. `npm run build`
3. `npm test`
4. Include failures/fixes and final output summary in PR description.

### How to test internal route auth

1. Ensure `OPENCTO_INTERNAL_API_TOKEN` is set as a secret.
2. Call an internal endpoint with:
   `x-opencto-internal-token: <token>`.
3. Confirm valid token returns expected result.
4. Confirm missing/invalid token is rejected.

## License

Apache-2.0

## References (Chicago 17th, Bibliography)

Cloudflare. n.d. "Cloudflare Workers." Cloudflare Docs. Accessed March 6, 2026. https://developers.cloudflare.com/workers/.

Cloudflare. n.d. "D1." Cloudflare Docs. Accessed March 6, 2026. https://developers.cloudflare.com/d1/.

Cloudflare. n.d. "Wrangler." Cloudflare Docs. Accessed March 6, 2026. https://developers.cloudflare.com/workers/wrangler/.

Stripe. n.d. "Webhooks." Stripe Docs. Accessed March 6, 2026. https://docs.stripe.com/webhooks.

Stripe. n.d. "Hosted Onboarding." Stripe Docs. Accessed March 6, 2026. https://docs.stripe.com/connect/hosted-onboarding.

World Wide Web Consortium (W3C). 2021. "Web Authentication: An API for Accessing Public Key Credentials Level 2." Accessed March 6, 2026. https://www.w3.org/TR/webauthn-2/.
