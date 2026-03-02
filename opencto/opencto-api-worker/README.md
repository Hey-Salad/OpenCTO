# OpenCTO API Worker

Cloudflare Workers backend for the OpenCTO dashboard (Phase 5 implementation).

## Overview

This worker provides the backend API for:
- Authentication (session, devices, passkeys)
- Compliance checks and evidence export
- Billing (Stripe integration, subscriptions, invoices)
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
- `GET /api/v1/codebase/metrics` - Per-user run metrics for the last 24 hours

Runtime controls:
- Create/cancel access restricted to `owner` and `cto` roles
- Repository URL validation restricted to `https://github.com/<owner>/<repo>[.git]`
- Command normalization + allowlist template enforcement
- Shell chaining guard (`&&`, `;`, `|`, backticks, `$(`)
- Per-user concurrent and daily run quotas
- Timeout clamp (`min/default/max`)
- Redaction for common token/key patterns in persisted logs/events

Execution mode:
- `CODEBASE_EXECUTION_MODE=stub` (default): creates local stub runs/events
- `CODEBASE_EXECUTION_MODE=container`: dispatches the run to `CODEBASE_EXECUTOR` container binding

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
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `JWT_SECRET` - Secret for JWT signing
- `WEBAUTHN_RP_ID` - WebAuthn relying party ID
- `WEBAUTHN_RP_NAME` - WebAuthn relying party name

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
