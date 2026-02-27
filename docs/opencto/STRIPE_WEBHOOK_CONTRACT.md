# Stripe Webhook Contract (Phase 3 Scaffold)

## Purpose

Defines the webhook events and minimal processing contract for Phase 3 billing foundations.

## Endpoint

- Suggested route: `POST /api/v1/billing/webhooks/stripe`
- Content type: `application/json`
- Signature validation: required via `Stripe-Signature` header and `STRIPE_WEBHOOK_SECRET`

## Required Events

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `checkout.session.completed`

## Event Handling Contract

For each event:

1. Verify signature before parsing payload.
2. Persist raw payload into append-only audit/event table.
3. Apply idempotency by `event.id`.
4. Update billing projection tables (`subscriptions`, `invoices`, `usage_entitlements`).
5. Return `2xx` only after durable write.

## Server Stub Location Notes

No dedicated backend runtime folder currently exists in this repository branch.

When backend is added, create:

- `server/billing/stripeWebhookHandler.ts`
- `server/routes/billing.ts`

Minimal handler scaffold:

- Switch on `event.type`
- TODO blocks for each required event
- Structured error logging without secret leakage
- Explicit idempotency and retry-safe behavior
