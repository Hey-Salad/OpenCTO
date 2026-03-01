# CLAUDE.md

Repository-specific execution guide for Claude Code.

## Objective
Ship safe, verifiable changes to `CTO-AI` without breaking existing behavior.

## Working Mode
- Work feature-by-feature.
- One PR per feature.
- Keep diffs small and reviewable.

## First Commands Per Task
```bash
git fetch --all --prune
git checkout main
git pull
git checkout -b <type>/<scope>-<short-name>
```

## Code Change Rules
- Edit only files required for the requested scope.
- Preserve existing architecture unless task explicitly asks for refactor.
- Do not introduce mock claims in UI copy.
- Keep branding consistent with OpenCTO design tokens:
  - `#111111` background
  - `#ed4c4c` primary accent
  - `Grandstander` headings
  - `Figtree` body

## Required Validation
Dashboard (`opencto/opencto-dashboard`):
```bash
npm run lint
npm run build
npm run test
```

API worker (`opencto/opencto-api-worker`):
```bash
npm run lint
npm run build
npm test
```

## PR Requirements
Every PR must include:
- What changed (factual bullet list)
- Why it changed
- Validation results
- Remaining risks / follow-ups

## Hard Safety Constraints
- Never commit secrets.
- Never push directly to `main`.
- Never use destructive git commands (`reset --hard`, forced checkout) unless explicitly asked.
- If repo is dirty with unknown changes, pause and ask whether to stash, commit, or use a clean clone.

## Conflict Handling
If multiple open PRs touch same files:
1. Rebase on latest `main`.
2. Resolve conflicts minimally.
3. Re-run full validation.
4. Update PR summary with conflict notes.

## Preferred Output Style
- Concise, factual, and implementation-first.
- No marketing claims unless verified in code.
- No emojis in product UI copy unless specifically requested.

## Handoff Format
At task completion, provide:
1. Branch name
2. Commit SHA
3. PR URL
4. Files changed
5. Lint/build/test status
6. Remaining risks and next concrete step
