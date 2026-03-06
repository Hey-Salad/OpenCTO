# OpenCTO Documentation

Working documentation index for the OpenCTO platform. Use this page as the navigation entrypoint.

## Start Here

Read in this order if you are new to OpenCTO:

1. `OPENCTO_PLATFORM_SPEC.md` for architecture and platform boundaries
2. `IMPLEMENTATION_ROADMAP.md` for phased delivery and current execution state
3. `OPENCTO_FRONTEND_BRAND_MONETISATION_SPEC.md` for product/brand/monetization requirements
4. `WORK_SPLIT_MULTI_TERMINAL.md` for parallel operator execution patterns

## Document Map

- `OPENCTO_PLATFORM_SPEC.md`: Core platform architecture spec
- `OPENCTO_FRONTEND_BRAND_MONETISATION_SPEC.md`: Frontend and monetization direction
- `IMPLEMENTATION_ROADMAP.md`: Delivery plan mapped to repository implementation
- `UI_REUSE_LEMAAI.md`: UI reuse and migration plan from `chilu18/LemaAI`
- `WORK_SPLIT_MULTI_TERMINAL.md`: Multi-terminal split for Codex/Claude/OpenClaw
- `ANYWAY.md`: Anyway + Traceloop observability model and verification checklist

## Design Constraints

- Theme: dark-first, black background surfaces
- Visual language: icons-only in product UI, no emoji usage in product docs/UI
- Brand tokens:
  - Cherry Red `#ed4c4c`
  - Peach `#faa09a`
  - Light Peach `#ffd0cd`
  - White `#ffffff`

## Domains and Routing Plan

Primary production domain: `opencto.works`

Recommended route split:

- `opencto.works`: marketing site
- `app.opencto.works`: authenticated app
- `market.opencto.works`: marketplace frontend
- `api.opencto.works`: public API surface

## Documentation Change Rules

When behavior changes in code, update the matching document in this folder in the same PR. Keep docs factual and avoid forward-looking claims for features that do not exist yet.

## How-To Guides

### How to add a new architecture or runbook document

1. Add the new Markdown file in `docs/opencto/`.
2. Add a one-line summary for it in this README under `Document Map`.
3. Link the document from the root [README](../../README.md) if it is a primary onboarding resource.
4. Ensure all claims are verifiable from code or deployed configuration.

### How to update existing docs safely

1. Confirm behavior in code before editing docs.
2. Update docs in the same branch/PR as the behavior change.
3. Avoid roadmap claims for unimplemented features.
4. Include references for external systems or protocols when relevant.

## References (Chicago 17th, Bibliography)

Cloudflare. n.d. "Cloudflare Workers." Cloudflare Docs. Accessed March 6, 2026. https://developers.cloudflare.com/workers/.

Cloudflare. n.d. "Cloudflare for Platforms: Custom Hostnames and Routing." Cloudflare Docs. Accessed March 6, 2026. https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/.

OpenAI. n.d. "Responses API." OpenAI Platform Docs. Accessed March 6, 2026. https://platform.openai.com/docs/api-reference/responses.
