![OpenCTO Cover](assets/Agentic%20Engineering%20Platform-S1.svg)

# OpenCTO

> Agentic engineering platform for building, running, and governing AI-powered software delivery.

[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![PR Quality](https://img.shields.io/badge/CI-PR%20Quality-1f6feb)](.github/workflows/pr-quality.yml)
[![Security](https://img.shields.io/badge/CI-Security%20%26%20Smoke-0a7f3f)](.github/workflows/ci-security.yml)
[![Dashboard](https://img.shields.io/badge/App-OpenCTO%20Dashboard-ed4c4c)](opencto/opencto-dashboard)

## What This Repo Contains

This monorepo combines OpenCTO product surfaces, API/runtime services, SDK/CLI tooling, and platform documentation.

- `opencto/`: product applications and platform modules
- `docs/`: architecture specs, plans, runbooks, and roadmap docs
- `cheri-ml/`: model-serving experiments
- `sheri-ml/`: coding/runtime tooling workspace

## Platform Surfaces

### Core OpenCTO

- `opencto/opencto-dashboard`: React + Vite dashboard (launchpad, auth, billing, codebase workflows)
- `opencto/opencto-api-worker`: Cloudflare Worker API (auth, billing, compliance, webhooks, run orchestration)
- `opencto/opencto-sdk-js`: TypeScript SDK (HTTP + MQTT + auth helpers)
- `opencto/opencto-cli`: CLI wrapper around OpenCTO SDK workflows
- `opencto/mobile-app`: Expo iOS-first app for auth, chat, voice/realtime, and run monitoring
- `opencto/opencto-voice-backend`: FastAPI backend for voice/run endpoints
- `opencto/opencto-google-live-backend`: FastAPI backend for Gemini/Vertex realtime sessions
- `opencto/opencto-landing`: static marketing site

### Supporting Modules

- `opencto/opencto-skills`: managed OpenCTO skill packs and manifest
- `opencto/Sheri-ML`: legacy Sheri docs and components
- `opencto/scripts`: release/install/demo scripts

## Architecture At A Glance

```text
Dashboard + Mobile + CLI/SDK
            |
            v
   OpenCTO API Worker (Cloudflare)
   - Auth / OTP / OAuth
   - Billing / Stripe Webhooks
   - Compliance + Evidence
   - Codebase Runs + Events
   - Realtime Token Minting
            |
            v
   D1 + Durable Objects + External Providers
```

## Quick Start

### 1) Dashboard

```bash
cd opencto/opencto-dashboard
npm ci
npm run dev
```

### 2) API Worker

```bash
cd opencto/opencto-api-worker
npm ci
npm run dev
```

### 3) SDK + CLI

```bash
cd opencto/opencto-sdk-js
npm ci && npm run build

cd ../opencto-cli
npm ci && npm run build
```

### 4) Mobile App

```bash
cd opencto/mobile-app
npm install
npm run ios
```

### 5) Google Live Backend

```bash
cd opencto/opencto-google-live-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8091
```

## Validation Gates

### Dashboard (`opencto/opencto-dashboard`)

```bash
npm run lint
npm run build
npm run test
```

### API Worker (`opencto/opencto-api-worker`)

```bash
npm run lint
npm run build
npm test
```

### Mobile App (`opencto/mobile-app`)

```bash
npm run lint
npm run build
npm run test
```

## Repository Layout

```text
CTO-AI/
├── opencto/
│   ├── opencto-dashboard/
│   ├── opencto-api-worker/
│   ├── opencto-sdk-js/
│   ├── opencto-cli/
│   ├── mobile-app/
│   ├── opencto-voice-backend/
│   ├── opencto-landing/
│   └── opencto-skills/
├── docs/
├── cheri-ml/
├── sheri-ml/
├── AGENTS.md
└── ROADMAP.md
```

## Documentation Index

- OpenCTO docs index: [docs/opencto/README.md](docs/opencto/README.md)
- Platform spec: [docs/opencto/OPENCTO_PLATFORM_SPEC.md](docs/opencto/OPENCTO_PLATFORM_SPEC.md)
- Frontend and monetisation spec: [docs/opencto/OPENCTO_FRONTEND_BRAND_MONETISATION_SPEC.md](docs/opencto/OPENCTO_FRONTEND_BRAND_MONETISATION_SPEC.md)
- Implementation roadmap: [docs/opencto/IMPLEMENTATION_ROADMAP.md](docs/opencto/IMPLEMENTATION_ROADMAP.md)
- OpenAI guide: [docs/opencto/OPENAI_IMPLEMENTATION_GUIDE.md](docs/opencto/OPENAI_IMPLEMENTATION_GUIDE.md)
- Google live guide: [docs/opencto/GOOGLE_LIVE_IMPLEMENTATION_GUIDE.md](docs/opencto/GOOGLE_LIVE_IMPLEMENTATION_GUIDE.md)
- Anyway guide: [docs/opencto/ANYWAY_IMPLEMENTATION_GUIDE.md](docs/opencto/ANYWAY_IMPLEMENTATION_GUIDE.md)
- Traceloop guide: [docs/opencto/TRACELOOP_IMPLEMENTATION_GUIDE.md](docs/opencto/TRACELOOP_IMPLEMENTATION_GUIDE.md)
- Public roadmap: [ROADMAP.md](ROADMAP.md)

## CI, Releases, and Workflow

- PR quality checks: `.github/workflows/pr-quality.yml`
- Security and smoke checks: `.github/workflows/ci-security.yml`
- Dashboard-specific CI: `.github/workflows/opencto-dashboard-ci.yml`
- Release flow: `.github/workflows/release.yml`

Tag-based release example:

```bash
git checkout main
git pull
git tag v1.0.0
git push origin v1.0.0
```

## Security and Governance

- Do not commit secrets, tokens, or credentials.
- Use `.env.example` files for placeholders only.
- Redact sensitive values in logs, screenshots, fixtures, and docs.
- Follow repo contribution and branching rules in [AGENTS.md](AGENTS.md).

## Community

- Feature request: https://github.com/Hey-Salad/OpenCTO/issues/new?template=feature_request.yml
- Bug report: https://github.com/Hey-Salad/OpenCTO/issues/new?template=bug_report.yml
- Pull requests: https://github.com/Hey-Salad/OpenCTO/pulls

## Legal

- License: [LICENSE](LICENSE) (Apache-2.0)
- Attribution: [NOTICE](NOTICE), [ATTRIBUTION.md](ATTRIBUTION.md)
- Trademark policy: [TRADEMARKS.md](TRADEMARKS.md)

## Contact

- Website: https://opencto.works
- Business inquiries: investors@heysalad.io
