import { getContainer } from '@cloudflare/containers'
import type { RequestContext } from './types'
import {
  BadRequestException,
  InternalServerException,
  NotFoundException,
  NotImplementedException,
  TooManyRequestsException,
  jsonResponse,
} from './errors'
import { redactSecrets, redactUnknown } from './redaction'

type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'timed_out'
type EventLevel = 'system' | 'info' | 'warn' | 'error'
type ExecutionMode = 'stub' | 'container'

interface ContainerExecutionLog {
  level: EventLevel
  message: string
}

interface ContainerExecutionResult {
  status: Extract<RunStatus, 'succeeded' | 'failed' | 'timed_out'>
  logs: ContainerExecutionLog[]
  errorMessage?: string
}

interface PullRequestSummary {
  number: number
  title: string
  url: string
}

type ContainerDispatchFn = (
  runId: string,
  payload: { repoUrl: string; baseBranch: string; targetBranch: string; commands: string[]; timeoutSeconds: number },
  ctx: RequestContext,
) => Promise<ContainerExecutionResult>

const ALLOWED_COMMAND_TEMPLATES = [
  'git clone',
  'git checkout -b',
  'npm install',
  'pnpm install',
  'npm test',
  'npm run build',
  'git add',
  'git commit',
  'git push',
] as const

const COMMAND_ALLOWLIST_VERSION = '2026-03-02'
const DEFAULT_CONCURRENT_RUN_CAP = 2
const DEFAULT_DAILY_RUN_CAP = 20
const DEFAULT_TIMEOUT_SECONDS = 600
const MIN_TIMEOUT_SECONDS = 60
const MAX_TIMEOUT_SECONDS = 1800
const TERMINAL_RUN_STATUSES = new Set<RunStatus>(['succeeded', 'failed', 'canceled', 'timed_out'])
const BLOCKED_CHAINING_PATTERN = /(?:&&|;|\|\||\||`|\$\()/

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

interface CodebaseRunArtifactRow {
  id: string
  run_id: string
  kind: string
  path: string
  size_bytes: number | null
  sha256: string | null
  url: string | null
  expires_at: string | null
  created_at: string
}

let schemaReady = false
let containerDispatcher: ContainerDispatchFn = defaultContainerDispatcher
const getContainerUnsafe = getContainer as unknown as (
  binding: unknown,
  instanceId: string,
) => { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> }

function nowIso(): string {
  return new Date().toISOString()
}

function extractRepoFullName(repoUrl: string, repoFullName: string | null): string | null {
  if (repoFullName && repoFullName.trim()) return repoFullName.trim()
  const sanitized = repoUrl
    .replace(/^https?:\/\/github.com\//i, '')
    .replace(/\.git$/i, '')
    .trim()
  if (!sanitized.includes('/')) return null
  return sanitized
}

function parsePositiveInt(input: string | undefined, fallback: number): number {
  if (!input) return fallback
  const parsed = Number.parseInt(input, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function getExecutionMode(ctx: RequestContext): ExecutionMode {
  return ctx.env.CODEBASE_EXECUTION_MODE === 'container' ? 'container' : 'stub'
}

function getConcurrentRunCap(ctx: RequestContext): number {
  return parsePositiveInt(ctx.env.CODEBASE_MAX_CONCURRENT_RUNS, DEFAULT_CONCURRENT_RUN_CAP)
}

function getDailyRunCap(ctx: RequestContext): number {
  return parsePositiveInt(ctx.env.CODEBASE_DAILY_RUN_LIMIT, DEFAULT_DAILY_RUN_CAP)
}

function getTimeoutBounds(ctx: RequestContext): { defaultTimeout: number; minTimeout: number; maxTimeout: number } {
  const minTimeout = parsePositiveInt(ctx.env.CODEBASE_RUN_MIN_TIMEOUT_SECONDS, MIN_TIMEOUT_SECONDS)
  const configuredMax = parsePositiveInt(ctx.env.CODEBASE_RUN_MAX_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS)
  const maxTimeout = Math.max(minTimeout, configuredMax)
  const configuredDefault = parsePositiveInt(ctx.env.CODEBASE_RUN_DEFAULT_TIMEOUT_SECONDS, DEFAULT_TIMEOUT_SECONDS)
  const defaultTimeout = Math.max(minTimeout, Math.min(maxTimeout, configuredDefault))
  return { defaultTimeout, minTimeout, maxTimeout }
}

function normalizeCommand(command: string): string {
  return command.replace(/\s+/g, ' ').trim()
}

function parseCommands(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map(normalizeCommand)
    .filter(Boolean)
}

function isBlockedCommand(command: string): boolean {
  return BLOCKED_CHAINING_PATTERN.test(command)
}

function isCommandAllowed(command: string): boolean {
  return ALLOWED_COMMAND_TEMPLATES.some((template) => command === template || command.startsWith(`${template} `))
}

function normalizeAndValidateCommands(raw: unknown): string[] {
  const commands = parseCommands(raw)
  if (commands.length === 0) {
    throw new BadRequestException('commands must include at least one command')
  }

  const blocked = commands.filter((command) => isBlockedCommand(command))
  if (blocked.length > 0) {
    throw new BadRequestException('Shell chaining is not allowed in commands', {
      blocked,
    })
  }

  const disallowed = commands.filter((command) => !isCommandAllowed(command))
  if (disallowed.length > 0) {
    throw new BadRequestException('One or more commands are not allowed', {
      disallowed,
      allowedTemplates: [...ALLOWED_COMMAND_TEMPLATES],
    })
  }

  return commands
}

function normalizeTimeoutSeconds(input: unknown, bounds: { defaultTimeout: number; minTimeout: number; maxTimeout: number }): number {
  if (input === null || typeof input === 'undefined') return bounds.defaultTimeout
  const numeric = typeof input === 'number' ? input : Number(input)
  if (!Number.isFinite(numeric)) {
    throw new BadRequestException('timeoutSeconds must be a valid number', {
      minTimeoutSeconds: bounds.minTimeout,
      maxTimeoutSeconds: bounds.maxTimeout,
    })
  }

  return Math.max(bounds.minTimeout, Math.min(bounds.maxTimeout, Math.trunc(numeric)))
}

function dayStartIsoUtc(reference: Date): string {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), 0, 0, 0, 0)).toISOString()
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
    errorMessage: row.error_message ? redactSecrets(row.error_message) : null,
  }
}

async function getGitHubAccessToken(ctx: RequestContext): Promise<string | null> {
  try {
    const row = await ctx.env.DB.prepare(
      'SELECT access_token FROM github_connections WHERE user_id = ? LIMIT 1',
    ).bind(ctx.userId).first<{ access_token: string }>()
    return row?.access_token ?? null
  } catch {
    return null
  }
}

async function findOpenPullRequestForRun(
  run: { repoUrl: string; repoFullName: string | null; targetBranch: string },
  ctx: RequestContext,
): Promise<PullRequestSummary | null> {
  const repoFullName = extractRepoFullName(run.repoUrl, run.repoFullName)
  if (!repoFullName) return null
  const [owner] = repoFullName.split('/')
  if (!owner || !run.targetBranch) return null

  const token = await getGitHubAccessToken(ctx)
  if (!token) return null

  const url = new URL(`https://api.github.com/repos/${encodeURIComponent(repoFullName)}/pulls`)
  url.searchParams.set('state', 'open')
  url.searchParams.set('head', `${owner}:${run.targetBranch}`)
  url.searchParams.set('per_page', '1')

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'opencto-api-worker',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) return null
  const pulls = await response.json().catch(() => []) as Array<{ number?: number; title?: string; html_url?: string }>
  const first = pulls[0]
  if (!first || typeof first.number !== 'number' || typeof first.title !== 'string' || typeof first.html_url !== 'string') {
    return null
  }
  return {
    number: first.number,
    title: first.title,
    url: first.html_url,
  }
}

function mapEvent(row: CodebaseRunEventRow) {
  return {
    id: row.id,
    runId: row.run_id,
    seq: row.seq,
    level: row.level,
    eventType: row.event_type,
    message: redactSecrets(row.message),
    payload: row.payload_json ? redactUnknown(JSON.parse(row.payload_json)) : null,
    createdAt: row.created_at,
  }
}

function isTerminalStatus(status: RunStatus): boolean {
  return TERMINAL_RUN_STATUSES.has(status)
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
  const safeMessage = redactSecrets(event.message)
  const safePayload = event.payload ? redactUnknown(event.payload) as Record<string, unknown> : null

  await ctx.env.DB.prepare(
    `INSERT INTO codebase_run_events (id, run_id, seq, level, event_type, message, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    runId,
    seq,
    event.level,
    event.eventType,
    safeMessage,
    safePayload ? JSON.stringify(safePayload) : null,
    nowIso(),
  ).run()
}

async function setRunStatus(runId: string, ctx: RequestContext, input: { status: RunStatus; errorMessage?: string | null }): Promise<void> {
  const timestamp = nowIso()
  if (input.status === 'running') {
    await ctx.env.DB.prepare(
      'UPDATE codebase_runs SET status = ?, started_at = COALESCE(started_at, ?), error_message = NULL WHERE id = ? AND user_id = ?',
    ).bind('running', timestamp, runId, ctx.userId).run()
    return
  }

  await ctx.env.DB.prepare(
    'UPDATE codebase_runs SET status = ?, completed_at = ?, error_message = ? WHERE id = ? AND user_id = ?',
  ).bind(input.status, timestamp, input.errorMessage ?? null, runId, ctx.userId).run()
}

async function enforceRunLimits(ctx: RequestContext): Promise<void> {
  const concurrentCap = getConcurrentRunCap(ctx)
  const concurrent = await ctx.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM codebase_runs
     WHERE user_id = ? AND status IN ('queued', 'running')`,
  ).bind(ctx.userId).first<{ count: number }>()

  if ((concurrent?.count ?? 0) >= concurrentCap) {
    throw new TooManyRequestsException('Concurrent run quota exceeded', {
      concurrentCap,
    })
  }

  const dailyCap = getDailyRunCap(ctx)
  const dayStart = dayStartIsoUtc(new Date())
  const daily = await ctx.env.DB.prepare(
    'SELECT COUNT(*) AS count FROM codebase_runs WHERE user_id = ? AND created_at >= ?',
  ).bind(ctx.userId, dayStart).first<{ count: number }>()

  if ((daily?.count ?? 0) >= dailyCap) {
    throw new TooManyRequestsException('Daily run quota exceeded', {
      dailyCap,
      dayStart,
    })
  }
}

function normalizeContainerResponse(payload: unknown): ContainerExecutionResult {
  const body = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {}
  const rawStatus = typeof body.status === 'string' ? body.status : 'failed'
  const status: ContainerExecutionResult['status'] =
    rawStatus === 'succeeded' || rawStatus === 'timed_out' ? rawStatus : 'failed'

  const logs = Array.isArray(body.logs)
    ? body.logs
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const row = entry as Record<string, unknown>
        const level = row.level
        const message = row.message
        if (typeof message !== 'string') return null
        if (level !== 'system' && level !== 'info' && level !== 'warn' && level !== 'error') return null
        return {
          level,
          message,
        }
      })
      .filter((item): item is ContainerExecutionLog => item !== null)
    : []

  const errorMessage = typeof body.errorMessage === 'string' ? body.errorMessage : undefined
  return { status, logs, errorMessage }
}

async function defaultContainerDispatcher(
  runId: string,
  payload: { repoUrl: string; baseBranch: string; targetBranch: string; commands: string[]; timeoutSeconds: number },
  ctx: RequestContext,
): Promise<ContainerExecutionResult> {
  if (!ctx.env.CODEBASE_EXECUTOR) {
    throw new NotImplementedException('Container execution requested but CODEBASE_EXECUTOR binding is not configured')
  }

  const instance = getContainerUnsafe(ctx.env.CODEBASE_EXECUTOR, runId)
  const response = await instance.fetch('http://container.internal/execute', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      runId,
      ...payload,
    }),
  })

  const rawBody = await response.json().catch(() => ({}))
  const normalized = normalizeContainerResponse(rawBody)

  if (!response.ok) {
    return {
      status: 'failed',
      logs: normalized.logs,
      errorMessage: normalized.errorMessage ?? `Container request failed with status ${response.status}`,
    }
  }

  return normalized
}

export function __setContainerDispatcherForTests(dispatcher: ContainerDispatchFn | null): void {
  containerDispatcher = dispatcher ?? defaultContainerDispatcher
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

  const commands = normalizeAndValidateCommands(payload.commands)
  const timeoutBounds = getTimeoutBounds(ctx)
  const timeoutSeconds = normalizeTimeoutSeconds(payload.timeoutSeconds, timeoutBounds)
  await enforceRunLimits(ctx)

  const createdAt = nowIso()
  const runId = crypto.randomUUID()
  const baseBranch = (payload.baseBranch ?? 'main').trim() || 'main'
  const targetBranch = (payload.targetBranch ?? `opencto/${runId.slice(0, 8)}`).trim() || `opencto/${runId.slice(0, 8)}`
  const executionMode = getExecutionMode(ctx)

  if (executionMode === 'container' && !ctx.env.CODEBASE_EXECUTOR) {
    throw new NotImplementedException('Container execution requested but CODEBASE_EXECUTOR binding is not configured')
  }

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
    COMMAND_ALLOWLIST_VERSION,
    timeoutSeconds,
    createdAt,
  ).run()

  await appendEvent(runId, {
    level: 'system',
    eventType: 'run.queued',
    message: 'Run queued for Cloudflare Container execution.',
    payload: {
      timeoutSeconds,
      commandAllowlistVersion: COMMAND_ALLOWLIST_VERSION,
      executionMode,
    },
  }, ctx)

  await appendEvent(runId, {
    level: 'info',
    eventType: 'run.plan',
    message: `Requested commands: ${commands.join(' | ')}`,
  }, ctx)

  if (executionMode === 'container') {
    await setRunStatus(runId, ctx, { status: 'running' })
    await appendEvent(runId, {
      level: 'system',
      eventType: 'run.dispatched',
      message: 'Run dispatched to container executor.',
    }, ctx)

    const result = await containerDispatcher(runId, {
      repoUrl,
      baseBranch,
      targetBranch,
      commands,
      timeoutSeconds,
    }, ctx)

    for (const log of result.logs) {
      await appendEvent(runId, {
        level: log.level,
        eventType: 'container.log',
        message: log.message,
      }, ctx)
    }

    if (result.status === 'succeeded') {
      await setRunStatus(runId, ctx, { status: 'succeeded' })
      await appendEvent(runId, {
        level: 'system',
        eventType: 'run.completed',
        message: 'Container execution completed successfully.',
      }, ctx)
    } else {
      await setRunStatus(runId, ctx, {
        status: result.status,
        errorMessage: result.errorMessage ?? 'Container execution failed',
      })
      await appendEvent(runId, {
        level: 'error',
        eventType: 'run.failed',
        message: result.errorMessage ?? 'Container execution failed',
      }, ctx)
    }
  }

  const row = await getRunRow(runId, ctx)
  return jsonResponse({
    run: mapRun(row),
    allowlist: [...ALLOWED_COMMAND_TEMPLATES],
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
  const pr = await findOpenPullRequestForRun(mapRun(row), ctx)

  return jsonResponse({
    run: mapRun(row),
    pullRequest: pr,
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

// GET /api/v1/codebase/runs/:id/events/stream
export async function streamCodebaseRunEvents(runId: string, request: Request, ctx: RequestContext): Promise<Response> {
  await getRunRow(runId, ctx)

  const url = new URL(request.url)
  const initialAfterSeq = Math.max(0, Number.parseInt(url.searchParams.get('afterSeq') ?? '0', 10) || 0)

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      let afterSeq = initialAfterSeq
      const encoder = new TextEncoder()

      const sendEvent = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      const close = () => {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          // no-op
        }
      }

      const tick = async (): Promise<void> => {
        if (closed) return
        try {
          const rows = await ctx.env.DB.prepare(
            `SELECT id, run_id, seq, level, event_type, message, payload_json, created_at
             FROM codebase_run_events
             WHERE run_id = ? AND seq > ?
             ORDER BY seq ASC
             LIMIT 200`,
          ).bind(runId, afterSeq).all<CodebaseRunEventRow>()

          const events = (rows.results ?? []).map(mapEvent)
          if (events.length > 0) {
            afterSeq = events[events.length - 1]!.seq
            sendEvent('events', { runId, events, lastSeq: afterSeq })
          } else {
            sendEvent('heartbeat', { runId, lastSeq: afterSeq })
          }

          const run = await getRunRow(runId, ctx)
          sendEvent('run', { run: mapRun(run) })

          if (isTerminalStatus(run.status)) {
            sendEvent('done', { runId, status: run.status })
            close()
            return
          }

          setTimeout(() => { void tick() }, 1500)
        } catch (error) {
          sendEvent('error', { message: error instanceof Error ? error.message : 'Failed to stream events' })
          close()
        }
      }

      void tick()
      request.signal.addEventListener('abort', close)
    },
    cancel() {
      // no-op
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}

// GET /api/v1/codebase/metrics
export async function getCodebaseMetrics(ctx: RequestContext): Promise<Response> {
  await ensureSchema(ctx)
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const row = await ctx.env.DB.prepare(
    `SELECT
       COUNT(*) AS total_runs,
       SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded_runs,
       SUM(CASE WHEN status IN ('failed', 'timed_out', 'canceled') THEN 1 ELSE 0 END) AS failed_runs,
       SUM(CASE WHEN status IN ('queued', 'running') THEN 1 ELSE 0 END) AS active_runs,
       AVG(
         CASE
           WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
           THEN (julianday(completed_at) - julianday(started_at)) * 86400
           ELSE NULL
         END
       ) AS avg_duration_seconds
     FROM codebase_runs
     WHERE user_id = ? AND created_at >= ?`,
  ).bind(ctx.userId, sinceIso).first<{
    total_runs: number | null
    succeeded_runs: number | null
    failed_runs: number | null
    active_runs: number | null
    avg_duration_seconds: number | null
  }>()

  return jsonResponse({
    window: '24h',
    since: sinceIso,
    totals: {
      totalRuns: row?.total_runs ?? 0,
      succeededRuns: row?.succeeded_runs ?? 0,
      failedRuns: row?.failed_runs ?? 0,
      activeRuns: row?.active_runs ?? 0,
      avgDurationSeconds: row?.avg_duration_seconds ? Number(row.avg_duration_seconds.toFixed(2)) : 0,
    },
  })
}

// GET /api/v1/codebase/runs
export async function listCodebaseRuns(request: Request, ctx: RequestContext): Promise<Response> {
  await ensureSchema(ctx)
  const url = new URL(request.url)
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20))
  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') ?? '0', 10) || 0)
  const repoUrl = (url.searchParams.get('repoUrl') ?? '').trim()

  const query = repoUrl
    ? ctx.env.DB.prepare(
      `SELECT id, user_id, repo_url, repo_full_name, base_branch, target_branch, status, requested_commands_json,
              command_allowlist_version, timeout_seconds, created_at, started_at, completed_at, canceled_at, error_message
       FROM codebase_runs
       WHERE user_id = ? AND repo_url = ?
       ORDER BY created_at DESC
       LIMIT ?
       OFFSET ?`,
    ).bind(ctx.userId, repoUrl, limit, offset)
    : ctx.env.DB.prepare(
      `SELECT id, user_id, repo_url, repo_full_name, base_branch, target_branch, status, requested_commands_json,
              command_allowlist_version, timeout_seconds, created_at, started_at, completed_at, canceled_at, error_message
       FROM codebase_runs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?
       OFFSET ?`,
    ).bind(ctx.userId, limit, offset)

  const rows = await query.all<CodebaseRunRow>()
  const runs = (rows.results ?? []).map(mapRun)
  const nextOffset = runs.length === limit ? offset + limit : null

  return jsonResponse({
    runs,
    nextOffset,
  })
}

// GET /api/v1/codebase/runs/:id/artifacts
export async function listCodebaseRunArtifacts(runId: string, ctx: RequestContext): Promise<Response> {
  await getRunRow(runId, ctx)

  const rows = await ctx.env.DB.prepare(
    `SELECT id, run_id, kind, path, size_bytes, sha256, url, expires_at, created_at
     FROM codebase_run_artifacts
     WHERE run_id = ?
     ORDER BY created_at DESC`,
  ).bind(runId).all<CodebaseRunArtifactRow>()

  const artifacts = (rows.results ?? []).map((row) => ({
    id: row.id,
    runId: row.run_id,
    kind: row.kind,
    path: row.path,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    url: row.url,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }))

  return jsonResponse({
    artifacts: [
      {
        id: 'log',
        runId,
        kind: 'log',
        path: 'run-log.txt',
        createdAt: nowIso(),
      },
      ...artifacts,
    ],
  })
}

// GET /api/v1/codebase/runs/:id/artifacts/:artifactId
export async function downloadCodebaseRunArtifact(runId: string, artifactId: string, ctx: RequestContext): Promise<Response> {
  await getRunRow(runId, ctx)

  if (artifactId === 'log') {
    const rows = await ctx.env.DB.prepare(
      `SELECT seq, level, event_type, message, created_at
       FROM codebase_run_events
       WHERE run_id = ?
       ORDER BY seq ASC`,
    ).bind(runId).all<{
      seq: number
      level: EventLevel
      event_type: string
      message: string
      created_at: string
    }>()

    const lines = (rows.results ?? []).map((row) => {
      const timestamp = new Date(row.created_at).toISOString()
      return `[${timestamp}] [#${row.seq}] [${row.level}] [${row.event_type}] ${row.message}`
    })
    const body = lines.join('\n')
    return new Response(body, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': `attachment; filename="${runId}-run-log.txt"`,
      },
    })
  }

  const artifact = await ctx.env.DB.prepare(
    `SELECT id, run_id, kind, path, size_bytes, sha256, url, expires_at, created_at
     FROM codebase_run_artifacts
     WHERE run_id = ? AND id = ?
     LIMIT 1`,
  ).bind(runId, artifactId).first<CodebaseRunArtifactRow>()

  if (!artifact) throw new NotFoundException('Codebase artifact not found')
  if (!artifact.url) throw new NotImplementedException('Artifact download URL is not available for this artifact')

  return jsonResponse({
    artifact: {
      id: artifact.id,
      runId: artifact.run_id,
      kind: artifact.kind,
      path: artifact.path,
      sizeBytes: artifact.size_bytes,
      sha256: artifact.sha256,
      url: artifact.url,
      expiresAt: artifact.expires_at,
      createdAt: artifact.created_at,
    },
  })
}

// POST /api/v1/codebase/runs/:id/cancel
export async function cancelCodebaseRun(runId: string, ctx: RequestContext): Promise<Response> {
  const row = await getRunRow(runId, ctx)

  if (TERMINAL_RUN_STATUSES.has(row.status)) {
    return jsonResponse({ run: mapRun(row) })
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

// GET /api/v1/codebase/runs/:id/pr
export async function getCodebaseRunPullRequest(runId: string, ctx: RequestContext): Promise<Response> {
  const row = await getRunRow(runId, ctx)
  const pr = await findOpenPullRequestForRun(mapRun(row), ctx)
  return jsonResponse({ pullRequest: pr })
}

// POST /api/v1/codebase/runs/:id/post-to-pr
export async function postCodebaseRunToPullRequest(runId: string, ctx: RequestContext): Promise<Response> {
  const run = mapRun(await getRunRow(runId, ctx))
  const pr = await findOpenPullRequestForRun(run, ctx)
  if (!pr) {
    throw new NotFoundException('No open pull request found for this run branch')
  }

  const token = await getGitHubAccessToken(ctx)
  if (!token) {
    throw new BadRequestException('GitHub is not connected for this user')
  }

  const eventsRes = await ctx.env.DB.prepare(
    `SELECT id, run_id, seq, level, event_type, message, payload_json, created_at
     FROM codebase_run_events
     WHERE run_id = ?
     ORDER BY seq ASC
     LIMIT 500`,
  ).bind(runId).all<CodebaseRunEventRow>()
  const events = (eventsRes.results ?? []).map(mapEvent)

  const started = run.startedAt ? new Date(run.startedAt).getTime() : new Date(run.createdAt).getTime()
  const ended = run.completedAt
    ? new Date(run.completedAt).getTime()
    : run.canceledAt
      ? new Date(run.canceledAt).getTime()
      : Date.now()
  const duration = Math.max(0, Math.round((ended - started) / 1000))
  const errorCount = events.filter((event) => event.level === 'error').length
  const firstError = events.find((event) => event.level === 'error')?.message ?? null

  const verdict = run.status === 'succeeded'
    ? 'PASSED'
    : run.status === 'failed'
      ? 'FAILED'
      : run.status === 'canceled'
        ? 'CANCELLED'
        : run.status === 'timed_out'
          ? 'TIMEOUT'
          : 'RUNNING'

  const summaryLines = [
    `OpenCTO Codebase Run: ${verdict}`,
    `Run ID: ${run.id}`,
    `Repo: ${extractRepoFullName(run.repoUrl, run.repoFullName) ?? run.repoUrl}`,
    `Branch: ${run.targetBranch}`,
    `Command: ${run.requestedCommands[0] ?? 'Custom'}`,
    `Duration: ${duration}s`,
    `Errors: ${errorCount}`,
  ]
  if (firstError) {
    summaryLines.push(`First error: ${firstError}`)
  }
  summaryLines.push(`Timestamp: ${new Date().toISOString()}`)
  const body = summaryLines.join('\n')

  const [owner, repo] = (extractRepoFullName(run.repoUrl, run.repoFullName) ?? '').split('/')
  if (!owner || !repo) {
    throw new BadRequestException('Invalid repository metadata for PR posting')
  }

  const commentRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${pr.number}/comments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'opencto-api-worker',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ body }),
    },
  )

  if (commentRes.status === 403) {
    return jsonResponse({
      error: 'Requires repo write access',
      code: 'FORBIDDEN',
      status: 403,
    }, 403)
  }

  if (!commentRes.ok) {
    return jsonResponse({
      error: 'Failed to post PR comment',
      code: 'UPSTREAM_ERROR',
      status: commentRes.status,
    }, 502)
  }

  return jsonResponse({ posted: true, pullRequest: pr })
}
