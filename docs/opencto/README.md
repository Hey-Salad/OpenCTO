# OpenCTO Documentation

This folder is the working documentation source for the OpenCTO platform build-out.

## Documents

- `OPENCTO_PLATFORM_SPEC.md`: Platform architecture and engineering spec (v0.3 baseline).
- `OPENCTO_FRONTEND_BRAND_MONETISATION_SPEC.md`: Frontend, brand, domain, and monetisation spec (v0.4 baseline).
- `IMPLEMENTATION_ROADMAP.md`: Practical phased delivery plan mapped to current repository state.
- `OPENAI_IMPLEMENTATION_GUIDE.md`: OpenAI-only implementation map, env setup, and runbook.
- `GOOGLE_MULTIMODAL_INTEGRATION_PLAN.md`: Google multimodal architecture and phased rollout plan.
- `GOOGLE_LIVE_IMPLEMENTATION_GUIDE.md`: Implemented Google realtime path, env setup, backend runbook, and usage guide.
- `ANYWAY_IMPLEMENTATION_GUIDE.md`: Anyway-only tracing implementation guide for cloudbot workflows.
- `TRACELOOP_IMPLEMENTATION_GUIDE.md`: Traceloop-only rollout and instrumentation guide.
- `OPENAI_CLOUDFLARE_TRACELOOP_IMPLEMENTATION_GUIDE.md`: Task-based implementation guide for OpenAI, Cloudflare, and Traceloop workflows.
- `UI_REUSE_LEMAAI.md`: UI reuse strategy for `chilu18/LemaAI` and migration into OpenCTO.
- `WORK_SPLIT_MULTI_TERMINAL.md`: Multi-terminal and multi-agent execution split (Codex, Claude, OpenClaw).

## Design Constraints

- Theme: dark-first, black background surfaces.
- Visual language: icons only, no emoji in product UI or docs.
- Brand tokens: Cherry Red `#ed4c4c`, Peach `#faa09a`, Light Peach `#ffd0cd`, White `#ffffff`.

## Domain

Primary production domain target: `opencto.works`.

Recommended route plan:

- `opencto.works`: marketing site
- `app.opencto.works`: authenticated app
- `api.opencto.works`: API
