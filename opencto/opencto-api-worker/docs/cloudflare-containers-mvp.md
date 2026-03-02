# Cloudflare Containers MVP Draft

This draft defines how `opencto-api-worker` orchestrates codebase execution inside Cloudflare Containers.

## Execution Flow

1. Dashboard calls `POST /api/v1/codebase/runs` with repository and allowlisted commands.
2. Worker writes a `codebase_runs` record and initial `codebase_run_events`.
3. Worker dispatches a container execution request to `CODEBASE_EXECUTOR` (future wiring).
4. Container streams lifecycle and command logs back as `codebase_run_events`.
5. Artifacts (logs, test reports, build metadata) are registered in `codebase_run_artifacts`.
6. Dashboard polls:
   - `GET /api/v1/codebase/runs/:id`
   - `GET /api/v1/codebase/runs/:id/events`

## Execution Mode Flag

- `CODEBASE_EXECUTION_MODE=stub`: current MVP behavior with local orchestration records.
- `CODEBASE_EXECUTION_MODE=container`: currently returns `NOT_IMPLEMENTED` until executor binding is wired.

## Required Runtime Controls

- Per-user concurrent run limit (default: 1 running, 3 queued)
- Max run timeout (default: 600s, hard cap: 1800s)
- Command allowlist enforcement in worker and container
- Network egress policy locked to required git/package registries
- Secret isolation via scoped bindings (never pass account-level credentials)
- Log scrubbing for token/key patterns before persistence

## Command Allowlist (MVP)

- `git clone`
- `git checkout -b`
- `npm install`
- `pnpm install`
- `npm test`
- `npm run build`
- `git add`
- `git commit`
- `git push`

## Future Integration Points

- Replace polling endpoint with SSE/WebSocket log stream.
- Add signed artifact download URLs (R2).
- Add branch protection + PR creation helper APIs.
- Add policy packs per repository/org.
