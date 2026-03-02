import type { RequestContext } from './types'
import {
  BadRequestException,
  ConflictException,
  InternalServerException,
  NotFoundException,
  jsonResponse,
} from './errors'

type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'timed_out'
type EventLevel = 'system' | 'info' | 'warn' | 'error'

const ALLOWED_COMMANDS = [
  'git clone',
  'git checkout -b',
  'npm install',
  'pnpm install',
  'npm test',
  'npm run build',
  'git add',
  'git commit',
  'git push',
]

const TERMINAL_RUN_STATUSES = new Set<RunStatus>(['succeeded', 'failed', 'canceled', 'timed_out'])

interface CodebaseRunRow {
  id: string
  user_id: string
  repo_url: string
  repo_full_name: string | null
  base_branch: string
  target_branch: string
  status: RunStatus
  requested_commands_json: string
  command_allowlist_version: string
  timeout_seconds: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  canceled_at: string | null
  error_message: string | null
}

interface CodebaseRunEventRow {
  id: string
  run_id: string
  seq: number
  level: EventLevel
  event_type: string
  message: string
  payload_json: string | null
  created_at: string
}

let schemaReady = false

function nowIso(): string {
  return new Date().toISOString()
}

function parseCommands(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

function isCommandAllowed(command: string): boolean {
  return ALLOWED_COMMANDS.some((prefix) => command === prefix || command.startsWith(`${prefix} `))
}

function mapRun(row: CodebaseRunRow) {
  return {
    id: row.id,
    userId: row.user_id,
    repoUrl: row.repo_url,
    repoFullName: row.repo_full_name,
    baseBranch: row.base_branch,
    targetBranch: row.target_branch,
    status: row.status,
    requestedCommands: JSON.parse(row.requested_commands_json) as string[],
    commandAllowlistVersion: row.command_allowlist_version,
    timeoutSeconds: row.timeout_seconds,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    canceledAt: row.canceled_at,
    errorMessage: row.error_message,
  }
}

function mapEvent(row: CodebaseRunEventRow) {
  return {
    id: row.id,
    runId: row.run_id,
    seq: row.seq,
    level: row.level,
    eventType: row.event_type,
    message: row.message,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    createdAt: row.created_at,
  }
}

async function ensureSchema(ctx: RequestContext): Promise<void> {
  if (!ctx.env.DB) {
    throw new InternalServerException('D1 database binding is not configured for codebase runs')
  }
  if (schemaReady) return

  await ctx.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS codebase_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      repo_url TEXT NOT NULL,
      repo_full_name TEXT,
      base_branch TEXT NOT NULL,
      target_branch TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled', 'timed_out')),
      requested_commands_json TEXT NOT NULL,
      command_allowlist_version TEXT NOT NULL,
      timeout_seconds INTEGER NOT NULL DEFAULT 600,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      canceled_at TEXT,
      error_message TEXT
    )`,
  ).run()

  await ctx.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS codebase_run_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      level TEXT NOT NULL CHECK (level IN ('system', 'info', 'warn', 'error')),
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES codebase_runs(id) ON DELETE CASCADE,
      UNIQUE (run_id, seq)
    )`,
  ).run()

  await ctx.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS codebase_run_artifacts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      path TEXT NOT NULL,
      size_bytes INTEGER,
      sha256 TEXT,
      url TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES codebase_runs(id) ON DELETE CASCADE
    )`,
  ).run()

  await ctx.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_codebase_runs_user_created ON codebase_runs (user_id, created_at DESC)').run()
  await ctx.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_codebase_runs_status ON codebase_runs (status)').run()
  await ctx.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_codebase_run_events_run_seq ON codebase_run_events (run_id, seq)').run()
  await ctx.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_codebase_run_artifacts_run ON codebase_run_artifacts (run_id)').run()

  schemaReady = true
}

async function getRunRow(runId: string, ctx: RequestContext): Promise<CodebaseRunRow> {
  await ensureSchema(ctx)
  const row = await ctx.env.DB.prepare(
    `SELECT id, user_id, repo_url, repo_full_name, base_branch, target_branch, status, requested_commands_json,
            command_allowlist_version, timeout_seconds, created_at, started_at, completed_at, canceled_at, error_message
     FROM codebase_runs WHERE id = ? AND user_id = ?`,
  ).bind(runId, ctx.userId).first<CodebaseRunRow>()

  if (!row) {
    throw new NotFoundException('Codebase run not found')
  }

  return row
}

async function getNextSeq(runId: string, ctx: RequestContext): Promise<number> {
  const row = await ctx.env.DB.prepare(
    'SELECT COALESCE(MAX(seq), 0) AS max_seq FROM codebase_run_events WHERE run_id = ?',
  ).bind(runId).first<{ max_seq: number }>()

  return (row?.max_seq ?? 0) + 1
}

async function appendEvent(
  runId: string,
  event: { level: EventLevel; eventType: string; message: string; payload?: Record<string, unknown> },
  ctx: RequestContext,
): Promise<void> {
  const seq = await getNextSeq(runId, ctx)
  await ctx.env.DB.prepare(
    `INSERT INTO codebase_run_events (id, run_id, seq, level, event_type, message, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    runId,
    seq,
    event.level,
    event.eventType,
    event.message,
    event.payload ? JSON.stringify(event.payload) : null,
    nowIso(),
  ).run()
}

// POST /api/v1/codebase/runs
export async function createCodebaseRun(
  payload: {
    repoUrl?: string
    repoFullName?: string
    baseBranch?: string
    targetBranch?: string
    commands?: unknown
    timeoutSeconds?: number
  },
  ctx: RequestContext,
): Promise<Response> {
  await ensureSchema(ctx)

  const repoUrl = (payload.repoUrl ?? '').trim()
  if (!repoUrl) {
    throw new BadRequestException('repoUrl is required')
  }

  const commands = parseCommands(payload.commands)
  if (commands.length === 0) {
    throw new BadRequestException('commands must include at least one command')
  }

  const disallowed = commands.filter((command) => !isCommandAllowed(command))
  if (disallowed.length > 0) {
    throw new BadRequestException('One or more commands are not allowed', {
      disallowed,
      allowedPrefixes: ALLOWED_COMMANDS,
    })
  }

  const createdAt = nowIso()
  const runId = crypto.randomUUID()
  const baseBranch = (payload.baseBranch ?? 'main').trim() || 'main'
  const targetBranch = (payload.targetBranch ?? `opencto/${runId.slice(0, 8)}`).trim() || `opencto/${runId.slice(0, 8)}`
  const timeoutSeconds = Number.isFinite(payload.timeoutSeconds) ? Math.max(60, Math.min(1800, Number(payload.timeoutSeconds))) : 600

  await ctx.env.DB.prepare(
    `INSERT INTO codebase_runs (
      id, user_id, repo_url, repo_full_name, base_branch, target_branch, status,
      requested_commands_json, command_allowlist_version, timeout_seconds, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    runId,
    ctx.userId,
    repoUrl,
    payload.repoFullName?.trim() || null,
    baseBranch,
    targetBranch,
    'queued',
    JSON.stringify(commands),
    '2026-03-02',
    timeoutSeconds,
    createdAt,
  ).run()

  await appendEvent(runId, {
    level: 'system',
    eventType: 'run.queued',
    message: 'Run queued for Cloudflare Container execution.',
    payload: {
      timeoutSeconds,
      commandAllowlistVersion: '2026-03-02',
    },
  }, ctx)

  await appendEvent(runId, {
    level: 'info',
    eventType: 'run.plan',
    message: `Requested commands: ${commands.join(' | ')}`,
  }, ctx)

  const row = await getRunRow(runId, ctx)
  return jsonResponse({
    run: mapRun(row),
    allowlist: ALLOWED_COMMANDS,
  }, 201)
}

// GET /api/v1/codebase/runs/:id
export async function getCodebaseRun(runId: string, ctx: RequestContext): Promise<Response> {
  const row = await getRunRow(runId, ctx)
  const eventCount = await ctx.env.DB.prepare('SELECT COUNT(*) AS count FROM codebase_run_events WHERE run_id = ?')
    .bind(runId)
    .first<{ count: number }>()
  const artifactCount = await ctx.env.DB.prepare('SELECT COUNT(*) AS count FROM codebase_run_artifacts WHERE run_id = ?')
    .bind(runId)
    .first<{ count: number }>()

  return jsonResponse({
    run: mapRun(row),
    metrics: {
      eventCount: eventCount?.count ?? 0,
      artifactCount: artifactCount?.count ?? 0,
    },
  })
}

// GET /api/v1/codebase/runs/:id/events
export async function getCodebaseRunEvents(runId: string, request: Request, ctx: RequestContext): Promise<Response> {
  await getRunRow(runId, ctx)

  const url = new URL(request.url)
  const afterSeq = Math.max(0, Number.parseInt(url.searchParams.get('afterSeq') ?? '0', 10) || 0)
  const limit = Math.min(500, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '200', 10) || 200))

  const rows = await ctx.env.DB.prepare(
    `SELECT id, run_id, seq, level, event_type, message, payload_json, created_at
     FROM codebase_run_events
     WHERE run_id = ? AND seq > ?
     ORDER BY seq ASC
     LIMIT ?`,
  ).bind(runId, afterSeq, limit).all<CodebaseRunEventRow>()

  const events = (rows.results ?? []).map(mapEvent)
  const lastSeq = events.at(-1)?.seq ?? afterSeq

  return jsonResponse({
    runId,
    events,
    lastSeq,
    pollAfterMs: 1500,
  })
}

// POST /api/v1/codebase/runs/:id/cancel
export async function cancelCodebaseRun(runId: string, ctx: RequestContext): Promise<Response> {
  const row = await getRunRow(runId, ctx)

  if (TERMINAL_RUN_STATUSES.has(row.status)) {
    throw new ConflictException(`Run is already ${row.status}`)
  }

  const canceledAt = nowIso()
  await ctx.env.DB.prepare(
    'UPDATE codebase_runs SET status = ?, canceled_at = ?, completed_at = ? WHERE id = ? AND user_id = ?',
  ).bind('canceled', canceledAt, canceledAt, runId, ctx.userId).run()

  await appendEvent(runId, {
    level: 'warn',
    eventType: 'run.canceled',
    message: 'Run canceled by user request.',
  }, ctx)

  const updated = await getRunRow(runId, ctx)
  return jsonResponse({ run: mapRun(updated) })
}
