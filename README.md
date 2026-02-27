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
