<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Hey-Salad/.github/refs/heads/main/HeySalad%20Logo%20%2B%20Tagline%20White.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Hey-Salad/.github/refs/heads/main/HeySalad%20Logo%20%2B%20Tagline%20Black.svg">
  <img src="https://raw.githubusercontent.com/Hey-Salad/.github/refs/heads/main/HeySalad%20Logo%20%2B%20Tagline%20Black.svg" alt="HeySalad Logo" width="420"/>
</picture>

# HeySalad CTO

Unified repository for running HeySalad AI engineering workflows across model serving, coding agents, and multi-agent orchestration.

## What Is In This Repo

The repository is organized into three execution layers:

- `cheri-ml`: inference and model-serving runtime
- `sheri-ml`: Codex-style coding runtime/tooling
- `opencto`: product surfaces, orchestration workers, APIs, and operations tooling

Supporting folders:

- `docs/`: architecture, roadmap, and operating documentation
- `hackathon/`: experiments and event prototypes

## Prerequisites

Install before running anything:

- Node.js `>= 18`
- npm
- Python `>= 3.10` (for Python-based services)
- Rust toolchain (for `sheri-ml/codex-rs` workflows)
- Cloudflare `wrangler` CLI (for worker deploy/dev flows)

## Quick Start (First 10 Minutes)

Pick one path and get it running end-to-end.

### 1) Inference Runtime (`cheri-ml`)

```bash
cd cheri-ml
python serve_model.py
```

### 2) Coding Runtime (`sheri-ml`)

```bash
cd sheri-ml/codex-rs
cargo build --release
```

### 3) OpenCTO Agent Orchestration (`opencto`)

```bash
cd opencto/Sheri-ML/sheri-ml-cli
npm install
npm run build
node dist/cli-v2.js --help
```

## Repository Layout

```text
CTO-AI/
├── cheri-ml/
├── sheri-ml/
├── opencto/
├── docs/
├── hackathon/
├── AGENTS.md
├── CLAUDE.md
└── VISION.md
```

## Where To Start In OpenCTO

Primary product surfaces:

- `opencto/opencto-dashboard`: user-facing dashboard
- `opencto/opencto-api-worker`: backend API worker
- `opencto/opencto-cloudbot-worker`: multi-channel bot worker
- `opencto/cto-orchestrator`: incident/governance orchestration loop

Docs index:

- [OpenCTO docs index](docs/opencto/README.md)
- [Platform spec](docs/opencto/OPENCTO_PLATFORM_SPEC.md)
- [Implementation roadmap](docs/opencto/IMPLEMENTATION_ROADMAP.md)

## README Index

Service and component READMEs:

- [Root README](README.md)
- [OpenCTO docs index](docs/opencto/README.md)
- [Sheri ML CLI](opencto/Sheri-ML/sheri-ml-cli/README.md)
- [CTO Orchestrator](opencto/cto-orchestrator/README.md)
- [OpenCTO API Worker](opencto/opencto-api-worker/README.md)
- [OpenCTO CloudBot Worker](opencto/opencto-cloudbot-worker/README.md)
- [OpenCTO Anyway Sidecar](opencto/opencto-cloudbot-worker/sidecar/README.md)
- [OpenCTO Marketplace Frontend](opencto/opencto-marketplace/README.md)
- [OpenCTO iOS Client](opencto/opencto-mobile-ios/opencto/README.md)

## Contribution Workflow

This repository follows the constraints documented in `AGENTS.md`.

Minimum expected workflow:

1. Sync `main` and create a scoped branch (`feat/...`, `fix/...`, or `docs/...`).
2. Keep each PR to one objective.
3. Run validation for the affected surface before opening a PR.
4. Open PR with changed files, validation summary, and known risks.

Validation baselines:

- Dashboard (`opencto/opencto-dashboard`): `npm run lint && npm run build && npm run test`
- API Worker (`opencto/opencto-api-worker`): `npm run lint && npm run build && npm test`

## How-To Guides

### How to sync and start a new task

1. `git fetch --all --prune`
2. `git checkout main && git pull`
3. `git checkout -b feat/<scope>-<short-name>`
4. Work in one surface only, then run that surface's validation commands.

### How to run API worker locally

1. `cd opencto/opencto-api-worker`
2. `npm install`
3. Configure Wrangler secrets and D1 migrations (see component README).
4. `npm run dev`

### How to run CloudBot worker locally

1. `cd opencto/opencto-cloudbot-worker`
2. `npm install`
3. Configure required secrets and webhook URLs.
4. `npm run dev`

## Open Source + Commercial Use

This project is open source under Apache-2.0 and intended for broad adoption.

For business implementation support (deployment, integration, managed operations), see [BUSINESS.md](BUSINESS.md).

## Legal

- License: [LICENSE](LICENSE) (Apache-2.0)
- Attribution: [NOTICE](NOTICE) and [ATTRIBUTION.md](ATTRIBUTION.md)
- Trademark policy: [TRADEMARKS.md](TRADEMARKS.md)
- HeySalad is a registered trademark (UK00004063403)

## Contact

- Website: https://heysalad.io
- Business implementation: investors@heysalad.io
- Company: HeySalad Inc., 584 Castro St, Suite #4003, San Francisco, CA 94114, US

## Release and PR Automation

- PR quality checks: `.github/workflows/pr-quality.yml`
- Security and smoke checks: `.github/workflows/ci-security.yml`
- Release workflow: `.github/workflows/release.yml`

Example tag release:

```bash
git checkout main
git pull
git tag v1.0.0
git push origin v1.0.0
```

## Roadmap and Feedback

- Public roadmap: [ROADMAP.md](ROADMAP.md)
- iOS roadmap: [docs/opencto/IOS_APP_ROADMAP.md](docs/opencto/IOS_APP_ROADMAP.md)
- OSS sync playbook: [docs/opencto/OSS_SYNC_PLAYBOOK.md](docs/opencto/OSS_SYNC_PLAYBOOK.md)
- Feature request: https://github.com/Hey-Salad/CTO-AI/issues/new?template=feature_request.yml
- Bug report: https://github.com/Hey-Salad/CTO-AI/issues/new?template=bug_report.yml

## References (Chicago 17th, Bibliography)

Cloudflare. n.d. "Cloudflare Workers." Cloudflare Docs. Accessed March 6, 2026. https://developers.cloudflare.com/workers/.

Cloudflare. n.d. "Wrangler." Cloudflare Docs. Accessed March 6, 2026. https://developers.cloudflare.com/workers/wrangler/.

Node.js. n.d. "Node.js Documentation." Accessed March 6, 2026. https://nodejs.org/docs/latest/api/.

OpenAI. n.d. "Responses API." OpenAI Platform Docs. Accessed March 6, 2026. https://platform.openai.com/docs/api-reference/responses.
