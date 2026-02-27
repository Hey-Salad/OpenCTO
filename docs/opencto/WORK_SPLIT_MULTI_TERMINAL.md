# Multi-Terminal Work Split Plan

Goal: parallel delivery across Codex, Claude, and two OpenClaw workers.

## Terminal Topology

- Terminal A: Codex CLI (implementation)
- Terminal B: Claude Code CLI (architecture and review)
- Terminal C: OpenClaw Worker 1 (frontend/UI)
- Terminal D: OpenClaw Worker 2 (backend/integration)

## Role Definitions

### Codex CLI (Terminal A)

Primary responsibility:

- Implement scoped tasks from approved tickets
- Produce PR-ready diffs with tests

Inputs:

- Task brief
- Acceptance criteria
- Risk class and policy constraints

Outputs:

- Branch commits
- test output
- implementation notes

### Claude Code CLI (Terminal B)

Primary responsibility:

- Technical design validation
- Spec alignment checks
- Code review and risk analysis

Outputs:

- design deltas
- review findings
- merge recommendation

### OpenClaw 1 (Terminal C)

Primary responsibility:

- UI implementation per frontend spec
- component and layout work
- dark-mode compliance and icon-only enforcement

Outputs:

- UI commits
- screenshot artifacts

### OpenClaw 2 (Terminal D)

Primary responsibility:

- API integrations and billing workflow wiring
- webhook handlers and usage tracking paths
- observability instrumentation

Outputs:

- backend commits
- integration tests

## Coordination Loop

1. Create a single task backlog with strict owner assignment.
2. Run 60-90 minute execution sprints.
3. End each sprint with:
   - branch status
   - risks
   - next handoff
4. Merge only after Claude review and CI pass.

## Branching Convention

- `feat/ui-*` for OpenClaw 1
- `feat/api-*` for OpenClaw 2
- `feat/core-*` for Codex CLI
- `review/*` notes for Claude outputs

## PR Gate

A PR merges only when:

- CI Security and Smoke passes
- PR Quality passes
- Spec section references are included
- No compliance BLOCK findings
