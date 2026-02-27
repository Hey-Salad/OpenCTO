# Phase 6 Plan - Production Readiness

## Objectives
- Replace frontend mock adapters with real API wiring by environment.
- Deploy Cloudflare Worker to staging and production.
- Wire D1 migrations and data lifecycle.
- Enable Stripe webhook in production with signature verification.
- Add CI/CD deploy workflow and protected release flow.
- Add integration tests for auth, billing, compliance, entitlement.

## Tasks
1. Frontend real API mode
2. D1 migration automation
3. Stripe live webhook setup
4. Server-side entitlement audit
5. Observability (request ids, audit logs)
6. CI deploy workflow (staging/prod)
7. End-to-end test suite

## Exit Criteria
- Dashboard works without mocks in staging
- Stripe events process idempotently in staging
- All CI checks green
- Deployment playbook documented
