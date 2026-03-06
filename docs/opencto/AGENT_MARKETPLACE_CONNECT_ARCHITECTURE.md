# OpenCTO Agent Marketplace (Stripe Connect + OpenLLMetry)

## Goal

Let providers publish rentable AI agents, let buyers rent them safely, and route payment to providers with platform fees while tracing each AI run end-to-end.

## v1 Architecture

1. Buyer creates a rental checkout session in OpenCTO API Worker.
2. Worker creates a Stripe Checkout Session (`mode=payment`) using Connect destination charges.
3. Stripe routes funds to provider connected account and keeps platform fee.
4. Stripe webhook confirms checkout completion and marks contract `paid`.
5. Orchestrator runs agent work and emits traces through OpenLLMetry.
6. Dashboard reads rental contracts + traces for operations and billing review.

## Stripe Connect model

- Charge model: destination charges.
- Why: marketplace is merchant of record and controls funds split.
- Fee model: `application_fee_amount` on each rental payment intent.
- Connected account onboarding: Express via account links.

## New API endpoints (implemented)

- `POST /api/v1/marketplace/connect/accounts`
  - Creates connected account for the caller workspace.
- `POST /api/v1/marketplace/connect/accounts/:accountId/onboarding-link`
  - Generates onboarding URL.
- `POST /api/v1/marketplace/agent-rentals/checkout/session`
  - Creates rental contract + Checkout session.
- `GET /api/v1/marketplace/agent-rentals`
  - Lists contracts where caller is renter or provider.

## Data model (implemented)

- `marketplace_connected_accounts`
  - workspace-to-Stripe-account mapping and onboarding status flags.
- `agent_rental_contracts`
  - renter/provider workspaces, agent slug, amount/fee, checkout/payment IDs, status.

## Webhook behavior (implemented)

- `checkout.session.completed` with metadata `flow=agent_marketplace_rental`
  - Marks matching contract `paid`.

## OpenLLMetry tracing

- Orchestrator startup now initializes `@traceloop/node-server-sdk` before the main loop.
- Tracing enabled when `OPENCTO_TRACE_ENABLED=true` and either:
  - `TRACELOOP_API_KEY` is set, or
  - `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

## Required environment variables

### API Worker

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_BASE_URL`
- `OPENCTO_MARKETPLACE_PLATFORM_FEE_PERCENT` (optional, default `12`)

### Orchestrator

- `OPENCTO_TRACE_ENABLED=true`
- `OPENCTO_TRACE_SERVICE_NAME=opencto-cto-orchestrator`
- `TRACELOOP_API_KEY` (for Traceloop SaaS)
- `OTEL_EXPORTER_OTLP_ENDPOINT` (optional if sending traces elsewhere)

## Next implementation steps

1. Add provider payout dashboard and connected account capability status sync.
2. Add recurring rentals (monthly) using Connect subscriptions + webhooks.
3. Add rental dispute/refund workflows and risk controls.
4. Tie run-level costs to rental contracts for margin analytics.
5. Add trace IDs into chat/task/activity APIs for full observability.
