# OpenCTO Next Steps (RPi Codex Handoff)

Last updated: 2026-03-01
Repo: `Hey-Salad/CTO-AI`
Baseline branch: `main`

## 1. Current State (Verified)
- Main is up to date and clean.
- Latest merged work includes:
  - PR #15: Launchpad route/branding integration.
  - PR #16: factual marketing redesign + modern dashboard UI + OAuth scaffolding + `@heysalad.io` super-admin policy.
- Routes currently in scope:
  - `/` (landing)
  - `/press`
  - `/blog`
  - `/app` (React dashboard)
  - `/playground` (app alias)
- Auth status:
  - Google/GitHub/Cloudflare login is scaffolded in frontend/mocks.
  - Super-admin policy utility exists and currently maps `@heysalad.io` emails to owner-level role in policy/mocks.

## 2. Priority Goal
Move from scaffolded frontend/mocks to production-ready backend-backed auth, billing, compliance, and job execution.

## 3. RPi Execution Plan (Ordered)

### Step A: Sync and branch from latest main
```bash
cd /home/admin/CTO-AI
# or: cd /home/peter/CTO-AI-phase2-clean

git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b feat/opencto-phase7-backend-auth-billing-compliance
```

### Step B: Validate local baseline before edits
```bash
cd opencto/opencto-dashboard
npm install
npm run lint
npm run build
npm run test
```

### Step C: Implement real OAuth backend integration
Frontend already has `signInWithProvider(provider)` contract. Next:
- Add backend endpoints for provider auth start/callback/session:
  - `POST /api/v1/auth/oauth/google/start`
  - `POST /api/v1/auth/oauth/github/start`
  - `POST /api/v1/auth/oauth/cloudflare/start`
  - `GET /api/v1/auth/session`
- Enforce super-admin policy server-side from verified email domain (`@heysalad.io`) at token/session issuance.
- Return `isSuperAdmin`, `role`, and `authProvider` in session response.

### Step D: Replace mock adapters behind a feature flag
- Keep mock adapters for local demo fallback.
- Introduce an API mode switch (`mock` vs `live`) using env.
- Wire `AuthHttpClient`, Billing client, Jobs client, Compliance client for live mode.

### Step E: Complete billing execution path
- Implement real checkout + portal + subscription + invoices endpoints.
- Add Stripe webhook endpoint with:
  - signature verification
  - idempotency
  - subscription/invoice state persistence
- Ensure UI consumes real data and handles error/loading/empty states.

### Step F: Complete compliance evidence workflow
- Implement:
  - `createComplianceCheck`
  - `getComplianceChecks`
  - `exportEvidencePackage`
- Persist export artifacts and return downloadable links.

### Step G: Job stream and approvals
- Replace mock jobs/steps data with live API + websocket stream.
- Persist approve/deny actions and audit trail.
- Gate dangerous actions by entitlement + role + server checks.

### Step H: Security and policy hardening
- Enforce role/entitlement checks on server for every mutating endpoint.
- Keep secrets only server-side; no secret values in frontend logs/UI.
- Add structured audit events for auth, approval, billing, compliance.

### Step I: CI/CD and release hygiene
- Ensure required CI checks on PRs (lint/build/test).
- Add smoke test step for key routes (`/`, `/press`, `/blog`, `/app`).
- Tag release when backend-live mode is stable.

## 4. Definition of Done for Phase 7
- OAuth login works end-to-end with at least one real provider.
- `@heysalad.io` super-admin policy enforced server-side.
- Billing data comes from real backend + webhooks reconciled.
- Compliance checks/evidence export use real backend storage.
- Jobs/approvals flow uses real API (no mock-only dependency in live mode).
- CI green on lint/build/test.

## 5. Recommended First RPi Prompt (Copy/Paste)
```text
Implement Phase 7 backend-live integration for OpenCTO.

Context:
- Repo: CTO-AI
- Read first:
  - docs/opencto/IMPLEMENTATION_ROADMAP.md
  - docs/opencto/PHASE6_PLAN.md
  - docs/opencto/NEXT_STEPS_RPI.md

Tasks:
1) Add server-backed OAuth session flow for Google/GitHub/Cloudflare.
2) Enforce super-admin role for verified @heysalad.io emails server-side.
3) Wire frontend auth to live mode using existing AuthHttpClient contract.
4) Keep mock fallback mode for local demos.
5) Run lint/build/test and report changed files + risks.

Rules:
- No fake metrics, no unverifiable claims.
- No secrets in code or logs.
- Keep current routes and branding unchanged.
```

## 6. Optional Parallel Workstreams
- Workstream 1: Backend auth/session.
- Workstream 2: Billing + Stripe webhook pipeline.
- Workstream 3: Jobs/compliance live data + websocket stream.

