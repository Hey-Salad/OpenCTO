# OpenCTO Phase 3 Implementation

Date: 2026-02-27
Branch: `feat/opencto-phase3-billing-monetisation`

## What Was Built

- Pricing page foundation with plan cards:
  - Starter, Developer, Team, Pro, Enterprise
  - Monthly/Yearly interval toggle
  - Team highlighted as recommended
- Billing dashboard foundation with:
  - Current plan card
  - Subscription status badge (`trialing`, `active`, `past_due`, `canceled`)
  - Usage blocks (jobs, workers, users, codex credit)
  - Invoices table skeleton
  - Upgrade and Manage Billing action stubs
- Stripe integration scaffolding:
  - Public config module from env vars
  - Typed billing API client stubs for checkout, portal, summary, invoices
  - Mock adapter wiring for immediate frontend testing
- Centralized billing contracts/types module
- Billing docs for webhook contract and server stub location guidance

## File Map

### Billing Types/Config/API

- `opencto/opencto-dashboard/src/types/billing.ts`
- `opencto/opencto-dashboard/src/config/stripe.ts`
- `opencto/opencto-dashboard/src/api/billingClient.ts`
- `opencto/opencto-dashboard/src/mocks/billingMockAdapter.ts`
- `opencto/opencto-dashboard/src/env.d.ts`

### Billing UI

- `opencto/opencto-dashboard/src/components/billing/PricingPage.tsx`
- `opencto/opencto-dashboard/src/components/billing/BillingDashboard.tsx`
- `opencto/opencto-dashboard/src/App.tsx`
- `opencto/opencto-dashboard/src/index.css`

### Tests

- `opencto/opencto-dashboard/src/components/billing/PricingPage.test.tsx`
- `opencto/opencto-dashboard/src/components/billing/BillingDashboard.test.tsx`

### Docs

- `docs/opencto/PHASE3_IMPLEMENTATION.md`
- `docs/opencto/STRIPE_WEBHOOK_CONTRACT.md`

## Env Vars Required

Frontend public values (no secrets):

- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_STRIPE_SUCCESS_URL`
- `VITE_STRIPE_CANCEL_URL`
- `VITE_STRIPE_PRICE_STARTER`
- `VITE_STRIPE_PRICE_DEVELOPER`
- `VITE_STRIPE_PRICE_TEAM`
- `VITE_STRIPE_PRICE_PRO`
- `VITE_STRIPE_PRICE_ENTERPRISE`

Backend-only values (must remain server-side, not committed):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Known Gaps For Phase 4

- Real Stripe SDK integration and authenticated checkout/portal endpoints.
- Webhook signature verification and persistence to billing/subscription tables.
- End-to-end entitlement enforcement from subscription state.
- Production invoice links/download actions and pagination.
- Security hardening: passkey/device trust integration and full audit event coverage.
