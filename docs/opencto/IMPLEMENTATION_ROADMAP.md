# OpenCTO Implementation Roadmap

This roadmap maps your new spec onto the current `CTO` repository structure.

## Current Baseline

Existing top-level components:

- `cheri-ml`
- `sheri-ml`
- `opencto`

Existing cross-cutting controls already present:

- Secret scanning (local hook + CI workflow)
- Basic CI smoke checks
- Contribution templates and release workflow

## Phase 0 - Documentation and Architecture Alignment

Goals:

- Land platform spec and frontend spec in `docs/opencto`
- Freeze naming (`@heysalad/cto`, `opencto.works`)
- Define source-of-truth architecture files

Deliverables:

- `docs/opencto/*.md`
- `docs/opencto/README.md` index

## Phase 1 - Frontend Foundation (dark mode, icon-only)

Goals:

- Set up app shell with three-column layout
- Implement brand tokens and typography system
- Enforce no-emoji UI content rule in linting/policy docs

Deliverables:

- Theme tokens
- Core layout primitives
- Top bar, left nav, center stream, right config scaffolds

## Phase 2 - Job Stream and Approval UX

Goals:

- Real job feed and detail stream
- Human approval card flow
- Agent message and compliance state rendering

Deliverables:

- Job list screen
- Job detail stream with status timeline
- Approval actions wired to backend API

## Phase 3 - Billing and Monetisation

Goals:

- Stripe products/prices + checkout
- Billing dashboard and usage displays
- Webhook ingestion and subscription state sync

Deliverables:

- Pricing page
- Billing routes
- Webhook handlers and subscription schema migration

## Phase 4 - Platform Hardening

Goals:

- Device auth + passkeys in all surfaces
- Full audit event coverage
- Compliance evidence package generation

Deliverables:

- Security and auth checks
- Exportable evidence bundle
- DORA metrics dashboard

## Phase 5 - Release and Growth

Goals:

- Contributor onboarding docs
- Stable release cadence with tags
- Public roadmap and issue labels

Deliverables:

- Semantic release process
- Public milestones
- Contributor playbook

## Architecture Adjustment Policy

As the build progresses, architecture changes are accepted only with:

- Updated spec section
- Migration note
- Backward compatibility impact statement
- Owner and review date
