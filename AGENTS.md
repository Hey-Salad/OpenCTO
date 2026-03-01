# AGENTS.md

This file defines how all coding agents (Codex, Claude, local bots) must work in this repository.

## Scope
- Applies to the full `CTO-AI` repository.
- Primary product surface: `opencto/opencto-dashboard`.
- Secondary surface: `opencto/opencto-api-worker`.

## Non-Negotiables
- Never commit secrets, API keys, tokens, or credentials.
- Never push directly to `main`.
- Never force-push shared branches.
- Never rewrite other agents' work without explicit intent in the PR.
- Never mix unrelated changes in one PR.

## Branch and PR Workflow
1. Sync before starting:
   - `git fetch --all --prune`
   - `git checkout main && git pull`
2. Create one feature branch per task:
   - `feat/<scope>-<short-name>` or `fix/<scope>-<short-name>` or `docs/<scope>-<short-name>`
3. Keep changes small and scoped to one objective.
4. Run validation before commit.
5. Open PR with a factual summary and test evidence.
6. Merge only after checks pass and review is complete.

## Required Validation
For dashboard changes (`opencto/opencto-dashboard`):
- `npm run lint`
- `npm run build`
- `npm run test`

For API worker changes (`opencto/opencto-api-worker`):
- `npm run lint`
- `npm run build`
- `npm test`

If a step fails, fix it before opening PR.

## Commit Rules
- Use conventional commit style:
  - `feat: ...`
  - `fix: ...`
  - `docs: ...`
  - `chore: ...`
- Keep message factual and specific.
- One logical change per commit where practical.

## Coordination Across Multiple Agents
- Assign each terminal one branch and one scope.
- Do not let two agents edit the same files concurrently.
- If overlap is unavoidable, stop and re-plan before coding.
- Prefer sequential handoffs over parallel edits for shared files like:
  - `opencto/opencto-dashboard/src/App.tsx`
  - global styles/routes/config files

## Definition of Done
A task is done only when:
- Code is implemented.
- Tests/lint/build pass for affected surface.
- PR is open with:
  - changed files list
  - validation output summary
  - known risks/next steps

## Merge Policy
- Prefer squash merge for feature branches.
- Delete merged branches.
- After merge: `git checkout main && git pull` before next task.

## Documentation Discipline
- Update docs for behavior changes.
- Keep docs factual and verifiable.
- No placeholder claims about features not implemented.

## Security and Compliance
- Use `.env.example` only for placeholders.
- Do not log sensitive values in UI, console, or error payloads.
- Redact secrets in screenshots, test fixtures, and docs.

## Escalation Rules
Stop and ask for direction when:
- Branch is dirty with unknown changes.
- You detect potential secret exposure.
- Requested change conflicts with existing architecture or active PRs.
