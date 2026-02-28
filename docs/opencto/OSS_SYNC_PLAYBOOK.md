# Open Source Sync Playbook

This playbook defines how to sync changes between internal workstreams and the public open source repository.

## Goals

- Keep public repository safe (no secrets, internal-only URLs, or private credentials).
- Maintain predictable sync cadence.
- Keep commit history understandable for contributors.

## Recommended Model

1. Develop in feature branches.
2. Open PRs to `main` in `CTO-AI`.
3. Before syncing externally, run secret scans and docs validation.
4. Sync only public-safe commits to open source target.

## Pre-Sync Checklist

- `git status` clean.
- CI green on PR (`PR Quality`, `CI Security and Smoke`).
- Secret scanning clean.
- No `.env` or credential material included.
- Public docs updated (`README`, `ROADMAP.md`, relevant phase docs).

## Sync Command Pattern

If using a second remote for open source:

```bash
git remote add public <public-repo-url>
git fetch public
git checkout main
git pull --ff-only
git push public main
```

If using selective sync from a feature branch:

```bash
git checkout -b sync/public-phase6 main
git cherry-pick <safe-commit-sha-1> <safe-commit-sha-2>
git push -u origin sync/public-phase6
```

## Hard Rules

- Never sync credentials, tokens, private service account content, or internal-only endpoints.
- Never force-push `main`.
- Always include a sync note in PR description:
  - scope
  - excluded private items
  - verification steps run

## Suggested Automation

- Add a `public-sync` workflow triggered manually (`workflow_dispatch`).
- Workflow should run:
  - markdown lint
  - secret scan
  - optional path allowlist validation
- Only push when checks pass.
