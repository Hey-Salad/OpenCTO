# OpenCTO API Worker

Cloudflare Workers backend for the OpenCTO dashboard (Phase 5 implementation).

## Overview

This worker provides the backend API for:
- Authentication (session, devices, passkeys)
- Compliance checks and evidence export
- Billing (Stripe integration, subscriptions, invoices)
- Marketplace billing (Stripe Connect account onboarding + agent rentals)
- Webhook handling with signature verification and idempotency

## Project Structure

```
opencto-api-worker/
├── src/
│   ├── index.ts              # Main entry point and router
│   ├── types.ts              # Shared TypeScript types
│   ├── errors.ts             # Unified error handling
│   ├── entitlements.ts       # Server-side entitlement enforcement
│   ├── auth.ts               # Auth endpoints
│   ├── compliance.ts         # Compliance endpoints
│   ├── billing.ts            # Billing endpoints
│   ├── webhooks.ts           # Stripe webhook handler
│   └── __tests__/            # Test files
├── migrations/               # D1 database migrations
│   └── 0001_initial_schema.sql
├── wrangler.toml             # Cloudflare Workers config
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Secrets

Set the following secrets using Wrangler:

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put JWT_SECRET
wrangler secret put WEBAUTHN_RP_ID
wrangler secret put WEBAUTHN_RP_NAME
```

### 3. Create D1 Database

```bash
wrangler d1 create opencto-production
```

Update the `database_id` in `wrangler.toml` with the ID from the output.

### 4. Run Migrations

```bash
wrangler d1 execute opencto-production --file=./migrations/0001_initial_schema.sql
```

## Development

### Local Development

```bash
npm run dev
```

This starts a local development server with hot reloading.

### Lint

```bash
npm run lint
```

### Build (Type Check)

```bash
npm run build
```

### Test

```bash
npm test
```

## Deployment

### Deploy to Production

```bash
npm run deploy
```

This deploys the worker to Cloudflare Workers.

## API Endpoints

### Auth

- `GET /api/v1/auth/session` - Get current session
- `GET /api/v1/auth/devices` - List trusted devices
- `POST /api/v1/auth/devices/:id/revoke` - Revoke a device
- `POST /api/v1/auth/passkeys/enroll/start` - Start passkey enrollment
- `POST /api/v1/auth/passkeys/enroll/complete` - Complete passkey enrollment

### Compliance

- `POST /api/v1/compliance/checks` - Create compliance check
- `GET /api/v1/compliance/checks` - List compliance checks
- `POST /api/v1/compliance/evidence/export` - Export evidence package

### Codebase Runs (MVP scaffold)

- `POST /api/v1/codebase/runs` - Queue a codebase execution run
- `GET /api/v1/codebase/runs/:id` - Get run status and metrics
- `GET /api/v1/codebase/runs/:id/events` - Poll run events/log lines
- `POST /api/v1/codebase/runs/:id/cancel` - Cancel queued/running run
- `POST /api/v1/codebase/runs/:id/approve` - Human-approve a pending dangerous run
- `POST /api/v1/codebase/runs/:id/deny` - Deny and cancel a pending dangerous run

Runtime controls:
- Command normalization + allowlist template enforcement
- Shell chaining guard (`&&`, `;`, `|`, backticks, `$(`)
- Per-user concurrent and daily run quotas
- Timeout clamp (`min/default/max`)
- Redaction for common token/key patterns in persisted logs/events
- Human approval gate for high-risk runs (`git push` and protected target branches)

Execution mode:
- `CODEBASE_EXECUTION_MODE=stub` (default): creates local stub runs/events
- `CODEBASE_EXECUTION_MODE=container`: dispatches the run to `CODEBASE_EXECUTOR` container binding

Internal worker-to-worker API for the Slack coding agent:
- `POST /api/v1/internal/codebase/runs?dispatch=async` - queue an async container run without end-user auth
- `GET /api/v1/internal/codebase/runs/:id` - fetch run status
- `GET /api/v1/internal/codebase/runs/:id/events` - fetch recent run events
- `POST /api/v1/internal/codebase/runs/:id/cancel` - cancel a queued/running run

Internal API requirements:
- send `x-opencto-internal-token` with the shared secret from `OPENCTO_INTERNAL_API_TOKEN`
- optionally send `x-opencto-service-user-email` to tag the service caller
- internal routes use the same command allowlist, quota, approval, and trace behavior as public codebase runs

Container runtime image:
- `container-runtime/codebase-executor/Dockerfile`
- `container-runtime/codebase-executor/server.js`
- Endpoint contract: `POST /execute` accepts run payload and returns `{ status, logs, errorMessage? }`

### Billing

- `GET /api/v1/billing/subscription` - Get subscription summary
- `GET /api/v1/billing/invoices` - List invoices
- `POST /api/v1/billing/checkout/session` - Create Stripe checkout session
- `POST /api/v1/billing/portal/session` - Create billing portal session
- `POST /api/v1/billing/webhooks/stripe` - Stripe webhook endpoint

### Marketplace (Connect)

- `POST /api/v1/marketplace/connect/accounts` - Create Stripe connected account for workspace
- `POST /api/v1/marketplace/connect/accounts/:id/onboarding-link` - Create onboarding link
- `POST /api/v1/marketplace/agent-rentals/checkout/session` - Create rental contract and checkout session
- `GET /api/v1/marketplace/agent-rentals` - List caller rental contracts

Marketplace redirect behavior:
- Stripe Connect onboarding links use `MARKETPLACE_BASE_URL` (fallback: `APP_BASE_URL`)
- Rental checkout success/cancel URLs use `MARKETPLACE_BASE_URL` (fallback: `APP_BASE_URL`)

## Security Features

### 1. Unified Error Handling
- Never exposes secrets or sensitive data in error responses
- Sanitizes error messages to remove tokens, keys, and secrets
- Returns generic error messages to clients while logging details server-side

### 2. Stripe Webhook Security
- Signature verification using `STRIPE_WEBHOOK_SECRET`
- Idempotent event processing (stores event IDs to prevent duplicates)
- Rejects webhooks with invalid or missing signatures

### 3. Entitlement Enforcement
- Server-side plan limits and feature checks
- Blocks actions that exceed plan limits
- Provides warnings when approaching limits

### 4. Authentication
- JWT-based authentication (stub implementation, needs completion)
- Device trust tracking
- Passkey support (WebAuthn)

### 5. Prompt and Scam Guardrails
- Codebase run requests enforce repo URL safety checks (blocks local/private/file targets).
- Prompt injection and secret-exfiltration patterns are blocked on chat persistence and run creation.
- Scam/social-engineering payment patterns are blocked with explicit `403 FORBIDDEN` responses.

## Testing

The project includes comprehensive tests for:

### Entitlement Tests (`src/__tests__/entitlements.test.ts`)
- Plan limit enforcement
- Feature access control
- Usage warnings
- Upgrade requirements

### Webhook Tests (`src/__tests__/webhooks.test.ts`)
- Signature verification
- Idempotency checks
- Event processing
- Database updates

Run tests with:
```bash
npm test
```

## Environment Variables

### Public (in wrangler.toml)
- `ENVIRONMENT` - Environment name (production, staging, etc.)

### Secrets (set via `wrangler secret put`)
- `OPENAI_API_KEY` - OpenAI API key used by backend integrations
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `JWT_SECRET` - Secret for JWT signing
- `WEBAUTHN_RP_ID` - WebAuthn relying party ID
- `WEBAUTHN_RP_NAME` - WebAuthn relying party name
- `OPENCTO_INTERNAL_API_TOKEN` - shared secret for trusted worker-to-worker codebase run requests
- `OPENCTO_MARKETPLACE_PLATFORM_FEE_PERCENT` - Optional default platform fee percent for marketplace rentals
- `MARKETPLACE_BASE_URL` - Optional marketplace frontend URL (e.g. `https://market.opencto.works`)

## Frontend Integration

This backend is compatible with the OpenCTO dashboard frontend (Phase 2-4):
- Matches the API contracts defined in Phase 4
- Implements all endpoints expected by the frontend clients
- Maintains type compatibility with frontend TypeScript interfaces

## Remaining Work

### TODO Items
1. Complete JWT authentication implementation
2. Implement full WebAuthn passkey verification
3. Add R2 storage for evidence exports
4. Add rate limiting
5. Add request logging and monitoring
6. Configure proper CORS policies
7. Add API documentation (OpenAPI/Swagger)

## License

Apache-2.0
