# Stripe Integration Starter Checklist

Use this checklist before building or reviewing any Stripe integration in OpenCTO.

## 1) Baseline

- Use official Stripe skills in Codex:
- `stripe-best-practices`
- `upgrade-stripe`
- Pin explicit Stripe API version in code.
- Prefer latest Stripe API unless product constraints require older version.

## 2) Integration Choice

- Prefer Stripe Checkout for web payments.
- Use Payment Element only when Checkout does not meet UX requirements.
- Use Billing APIs for subscription/recurring models.
- Do not use deprecated/legacy paths (Charges/Sources/Card Element unless migration-only context).

## 3) Security and Secrets

- Store secret keys only in server-side secrets management.
- Never expose secret key in client/mobile code.
- Validate webhook signatures on all inbound Stripe events.
- Keep environment split (test/live) and verify keys match environment.

## 4) Webhook Reliability

- Make webhook handlers idempotent.
- Persist event IDs to prevent duplicate processing.
- Return fast 2xx responses and process heavy work async.
- Log failures with enough context for replay.

## 5) Core Product Flows

- One-time payments: Checkout Session + fulfillment webhook.
- Subscriptions: Checkout Session/Billing + lifecycle webhooks.
- Failed payment handling: retry logic + user notification path.
- Refund path defined and tested.

## 6) Observability

- Capture request IDs and Stripe event IDs in logs.
- Track payment funnel metrics: created, succeeded, failed, refunded.
- Alert on webhook failure rate and payment failure spikes.

## 7) Go-Live Controls

- Run Stripe go-live checklist.
- Verify tax, currency, and region settings.
- Confirm dispute/chargeback response process.
- Validate dashboard roles and least-privilege access.

## 8) OpenCTO-specific Definition of Done

- Integration PR includes architecture note and webhook contract.
- Tests cover success and failure webhooks.
- Runbook includes rollback and incident response.
- Team can replay failed webhook events safely.

## Installed Stripe Skills (Codex)

- `/home/hs-chilu/.codex/skills/stripe-best-practices/SKILL.md`
- `/home/hs-chilu/.codex/skills/upgrade-stripe/SKILL.md`
