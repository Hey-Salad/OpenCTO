<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Hey-Salad/.github/refs/heads/main/HeySalad%20Logo%20%2B%20Tagline%20White.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Hey-Salad/.github/refs/heads/main/HeySalad%20Logo%20%2B%20Tagline%20Black.svg">
  <img src="https://raw.githubusercontent.com/Hey-Salad/.github/refs/heads/main/HeySalad%20Logo%20%2B%20Tagline%20Black.svg" alt="HeySalad Logo" width="420"/>
</picture>

# HeySalad CTO

Build, run, and scale autonomous AI CTO workflows across coding, inference, and multi-agent operations.

## Why This Exists

HeySalad CTO is a unified control repo for three execution layers:

- `cheri-ml`: inference and model-serving runtime
- `sheri-ml`: Codex-style coding workflows
- `opencto`: multi-agent orchestration and operations

The goal is simple: one operating system for AI engineering teams.

## Quick Start

```bash
# 1) Inference server
cd cheri-ml
python serve_model.py

# 2) Codex workflows
cd ../sheri-ml/codex-rs
cargo build --release

# 3) Agent orchestration
cd ../../opencto/Sheri-ML/sheri-ml-cli
npm install
npm start
```

## Repository Layout

```text
CTO/
├── cheri-ml/      # inference server
├── sheri-ml/      # coding/runtime tooling
├── opencto/       # agent orchestration
├── docs/          # architecture + guides
├── AGENTS.md
├── CLAUDE.md
└── VISION.md
```

## Open Source + Commercial Use

This project is open source under Apache-2.0 and intended for broad adoption.

If your team wants business implementation support (deployment, integration, managed operations), see [BUSINESS.md](BUSINESS.md).

## Legal

- License: [LICENSE](LICENSE) (Apache-2.0)
- Attribution: [NOTICE](NOTICE) and [ATTRIBUTION.md](ATTRIBUTION.md)
- Trademark policy: [TRADEMARKS.md](TRADEMARKS.md)
- HeySalad is a registered trademark (UK00004063403)

## Contact

- Website: https://heysalad.io
- Business implementation: investors@heysalad.io
- Company: HeySalad Inc., 584 Castro St, Suite #4003, San Francisco, CA 94114, US

## Repository Stats

[![GitHub stars](https://img.shields.io/github/stars/Hey-Salad/CTO-AI?style=for-the-badge)](https://github.com/Hey-Salad/CTO-AI/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Hey-Salad/CTO-AI?style=for-the-badge)](https://github.com/Hey-Salad/CTO-AI/network/members)
[![GitHub issues](https://img.shields.io/github/issues/Hey-Salad/CTO-AI?style=for-the-badge)](https://github.com/Hey-Salad/CTO-AI/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/Hey-Salad/CTO-AI?style=for-the-badge)](https://github.com/Hey-Salad/CTO-AI/pulls)
[![GitHub repo size](https://img.shields.io/github/repo-size/Hey-Salad/CTO-AI?style=for-the-badge)](https://github.com/Hey-Salad/CTO-AI)

[![Star History Chart](https://api.star-history.com/svg?repos=Hey-Salad%2FCTO-AI&type=Date)](https://star-history.com/#Hey-Salad/CTO-AI&Date)

## Release and PR Process

- Pull requests to `main` run quality checks via `.github/workflows/pr-quality.yml`.
- Security and smoke checks run via `.github/workflows/ci-security.yml`.
- Releases are created from tags like `v1.2.3` (or manual dispatch) via `.github/workflows/release.yml`.

Example release flow:

```bash
git checkout main
git pull
git tag v1.0.0
git push origin v1.0.0
```

## Architecture Docs

- OpenCTO docs index: [docs/opencto/README.md](docs/opencto/README.md)
- Platform spec: [docs/opencto/OPENCTO_PLATFORM_SPEC.md](docs/opencto/OPENCTO_PLATFORM_SPEC.md)
- Frontend, brand and monetisation spec: [docs/opencto/OPENCTO_FRONTEND_BRAND_MONETISATION_SPEC.md](docs/opencto/OPENCTO_FRONTEND_BRAND_MONETISATION_SPEC.md)
- Implementation roadmap: [docs/opencto/IMPLEMENTATION_ROADMAP.md](docs/opencto/IMPLEMENTATION_ROADMAP.md)

## Product Roadmap and Community Feedback

- Public roadmap: [ROADMAP.md](ROADMAP.md)
- iOS app roadmap: [docs/opencto/IOS_APP_ROADMAP.md](docs/opencto/IOS_APP_ROADMAP.md)
- Open source sync playbook: [docs/opencto/OSS_SYNC_PLAYBOOK.md](docs/opencto/OSS_SYNC_PLAYBOOK.md)
- Request a feature: https://github.com/Hey-Salad/CTO-AI/issues/new?template=feature_request.yml
- Report a bug: https://github.com/Hey-Salad/CTO-AI/issues/new?template=bug_report.yml
