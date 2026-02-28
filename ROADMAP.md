# OpenCTO Roadmap

This roadmap tracks what is planned for the open source version of OpenCTO.

## Current Status

- Phase 2 complete: Jobs list, stream, and human approval foundations.
- Phase 3 complete: Billing and monetisation UI foundations.
- Phase 4 complete: Auth and compliance hardening foundations.
- Phase 5 complete: Cloudflare backend integration baseline.
- Phase 6 planning merged: production readiness plan and implementation scope.

## Near-Term Priorities

1. Phase 6 implementation: real API integration from frontend to Cloudflare worker.
2. Stripe production readiness: webhook hardening, idempotency replay validation.
3. Deployment readiness: staging and production runbooks for D1, secrets, and deploy.
4. Observability: structured request tracing, audit events, and operational metrics.

## iOS App Track

1. Extract shared API client contracts and auth models from web dashboard.
2. Build iOS shell (SwiftUI) with auth, jobs feed, and job detail stream.
3. Add approval workflows (approve/deny) with biometric gating.
4. Add compliance and billing read views.

See detailed plan in `docs/opencto/IOS_APP_ROADMAP.md`.

## Open Source Sync Track

We maintain private and open source workflows. Public-safe changes should be synced in a controlled way.

See `docs/opencto/OSS_SYNC_PLAYBOOK.md` for process and commands.

## Request Features and Report Bugs

- Feature requests: https://github.com/Hey-Salad/CTO-AI/issues/new?template=feature_request.yml
- Bug reports: https://github.com/Hey-Salad/CTO-AI/issues/new?template=bug_report.yml
- Pull requests: https://github.com/Hey-Salad/CTO-AI/pulls

## Definition of Done for Roadmap Items

- Code merged to `main`.
- CI checks passing.
- Docs updated (implementation file + runbook where relevant).
- Security review complete for auth, secrets, and public exposure risk.
