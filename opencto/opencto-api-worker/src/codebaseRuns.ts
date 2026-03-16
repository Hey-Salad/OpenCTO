import { getContainer } from '@cloudflare/containers'
import type { RequestContext } from './types'
import {
  BadRequestException,
  ForbiddenException,
  InternalServerException,
  NotFoundException,
  NotImplementedException,
  TooManyRequestsException,
  jsonResponse,
} from './errors'
import { redactSecrets, redactUnknown } from './redaction'
import { enforcePromptGuardrails, enforceRepoUrlGuardrails } from './guardrails'

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
const PROTECTED_BRANCH_PATTERN = /^(main|master|production|prod|release.*)$/i

interface CodebaseRunRow {
  id: string
  user_id: string
  trace_id: string | null
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

type ApprovalEventRow = {
  event_type: string
  payload_json: string | null
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
    traceId: row.trace_id,
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

function parseRequestedCommands(row: CodebaseRunRow): string[] {
  try {
    const parsed = JSON.parse(row.requested_commands_json)
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return []
  }
}

function runNeedsHumanApproval(commands: string[], targetBranch: string): { required: boolean; reason: string | null } {
  if (commands.some((command) => command.startsWith('git push'))) {
    return { required: true, reason: 'Run includes git push command' }
  }
  if (PROTECTED_BRANCH_PATTERN.test(targetBranch)) {
    return { required: true, reason: 'Run targets protected branch' }
  }
  return { required: false, reason: null }
}

function ensureApproverRole(ctx: RequestContext): void {
  if (ctx.user.role === 'owner' || ctx.user.role === 'cto') return
  throw new ForbiddenException('Only owner/cto can approve dangerous runs', {
    role: ctx.user.role,
  })
}

async function getRunApproval(runId: string, ctx: RequestContext) {
  const rows = await ctx.env.DB.prepare(
    `SELECT event_type, payload_json, created_at
     FROM codebase_run_events
     WHERE run_id = ?
       AND event_type IN ('run.approval_required', 'run.approval.approved', 'run.approval.denied')
     ORDER BY seq ASC`,
  ).bind(runId).all<ApprovalEventRow>()

  const events = rows.results ?? []
  const requiredEvent = events.find((event) => event.event_type === 'run.approval_required')
  if (!requiredEvent) {
    return {
      required: false,
      state: 'not_required' as const,
      reason: null,
      approvedByUserId: null,
      decidedAt: null,
    }
  }

  const approvedEvent = events.find((event) => event.event_type === 'run.approval.approved')
  if (approvedEvent) {
    let approvedByUserId: string | null = null
    try {
      const payload = approvedEvent.payload_json ? JSON.parse(approvedEvent.payload_json) as Record<string, unknown> : {}
      approvedByUserId = typeof payload.approvedByUserId === 'string' ? payload.approvedByUserId : null
    } catch {
      // Ignore malformed approval payloads and fall back to null metadata.
    }
    return {
      required: true,
      state: 'approved' as const,
      reason: null,
      approvedByUserId,
      decidedAt: approvedEvent.created_at,
    }
  }

  const deniedEvent = events.find((event) => event.event_type === 'run.approval.denied')
  if (deniedEvent) {
    return {
      required: true,
      state: 'denied' as const,
      reason: 'Denied by human approver',
      approvedByUserId: null,
      decidedAt: deniedEvent.created_at,
    }
  }

  let reason: string | null = null
  try {
    const payload = requiredEvent.payload_json ? JSON.parse(requiredEvent.payload_json) as Record<string, unknown> : {}
    reason = typeof payload.reason === 'string' ? payload.reason : null
  } catch {
    // Ignore malformed approval payloads and fall back to a null reason.
  }

  return {
    required: true,
    state: 'pending' as const,
    reason,
    approvedByUserId: null,
    decidedAt: null,
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

async function ensureSchema(ctx: RequestContext): Promise<void> {
  if (!ctx.env.DB) {
    throw new InternalServerException('D1 database binding is not configured for codebase runs')
  }
  if (schemaReady) return

  await ctx.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS codebase_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      trace_id TEXT,
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
  await ctx.env.DB.prepare('ALTER TABLE codebase_runs ADD COLUMN trace_id TEXT').run().catch(() => {})

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
    `SELECT id, user_id, trace_id, repo_url, repo_full_name, base_branch, target_branch, status, requested_commands_json,
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

async function executeContainerRun(
  runId: string,
  input: {
    repoUrl: string
    baseBranch: string
    targetBranch: string
    commands: string[]
    timeoutSeconds: number
  },
  ctx: RequestContext,
): Promise<void> {
  await setRunStatus(runId, ctx, { status: 'running' })
  await appendEvent(runId, {
    level: 'system',
    eventType: 'run.dispatched',
    message: 'Run dispatched to container executor.',
  }, ctx)

  const result = await containerDispatcher(runId, input, ctx)

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
  enforceRepoUrlGuardrails(repoUrl)

  const commands = normalizeAndValidateCommands(payload.commands)
  enforcePromptGuardrails(
    `${repoUrl}\n${commands.join('\n')}\n${payload.baseBranch ?? ''}\n${payload.targetBranch ?? ''}`,
    'codebase.runs.create',
  )
  const timeoutBounds = getTimeoutBounds(ctx)
  const timeoutSeconds = normalizeTimeoutSeconds(payload.timeoutSeconds, timeoutBounds)
  await enforceRunLimits(ctx)

  const createdAt = nowIso()
  const runId = crypto.randomUUID()
  const baseBranch = (payload.baseBranch ?? 'main').trim() || 'main'
  const targetBranch = (payload.targetBranch ?? `opencto/${runId.slice(0, 8)}`).trim() || `opencto/${runId.slice(0, 8)}`
  const executionMode = getExecutionMode(ctx)
  const approvalPolicy = runNeedsHumanApproval(commands, targetBranch)

  if (executionMode === 'container' && !ctx.env.CODEBASE_EXECUTOR) {
    throw new NotImplementedException('Container execution requested but CODEBASE_EXECUTOR binding is not configured')
  }

  await ctx.env.DB.prepare(
    `INSERT INTO codebase_runs (
      id, user_id, trace_id, repo_url, repo_full_name, base_branch, target_branch, status,
      requested_commands_json, command_allowlist_version, timeout_seconds, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    runId,
    ctx.userId,
    ctx.traceContext.traceId,
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

  if (approvalPolicy.required) {
    await appendEvent(runId, {
      level: 'warn',
      eventType: 'run.approval_required',
      message: 'Human approval required before run execution.',
      payload: {
        reason: approvalPolicy.reason,
      },
    }, ctx)
  } else if (executionMode === 'container') {
    await executeContainerRun(runId, {
      repoUrl,
      baseBranch,
      targetBranch,
      commands,
      timeoutSeconds,
    }, ctx)
  }

  const row = await getRunRow(runId, ctx)
  const approval = await getRunApproval(runId, ctx)
  return jsonResponse({
    run: {
      ...mapRun(row),
      approval,
    },
    allowlist: [...ALLOWED_COMMAND_TEMPLATES],
  }, 201)
}

// GET /api/v1/codebase/runs/:id
export async function getCodebaseRun(runId: string, ctx: RequestContext): Promise<Response> {
  const row = await getRunRow(runId, ctx)
  const approval = await getRunApproval(runId, ctx)
  const eventCount = await ctx.env.DB.prepare('SELECT COUNT(*) AS count FROM codebase_run_events WHERE run_id = ?')
    .bind(runId)
    .first<{ count: number }>()
  const artifactCount = await ctx.env.DB.prepare('SELECT COUNT(*) AS count FROM codebase_run_artifacts WHERE run_id = ?')
    .bind(runId)
    .first<{ count: number }>()

  return jsonResponse({
    run: {
      ...mapRun(row),
      approval,
    },
    metrics: {
      eventCount: eventCount?.count ?? 0,
      artifactCount: artifactCount?.count ?? 0,
    },
  })
}

// POST /api/v1/codebase/runs/:id/approve
export async function approveCodebaseRun(
  runId: string,
  payload: { note?: string } | undefined,
  ctx: RequestContext,
): Promise<Response> {
  ensureApproverRole(ctx)
  const row = await getRunRow(runId, ctx)
  if (TERMINAL_RUN_STATUSES.has(row.status)) {
    throw new BadRequestException('Cannot approve a completed run')
  }

  const approval = await getRunApproval(runId, ctx)
  if (!approval.required) {
    throw new BadRequestException('Run does not require human approval')
  }
  if (approval.state !== 'pending') {
    throw new BadRequestException('Approval decision already recorded')
  }

  await appendEvent(runId, {
    level: 'system',
    eventType: 'run.approval.approved',
    message: 'Run approved by human reviewer.',
    payload: {
      approvedByUserId: ctx.userId,
      approverRole: ctx.user.role,
      note: payload?.note ?? null,
    },
  }, ctx)

  if (getExecutionMode(ctx) === 'container') {
    if (!ctx.env.CODEBASE_EXECUTOR) {
      throw new NotImplementedException('Container execution requested but CODEBASE_EXECUTOR binding is not configured')
    }
    await executeContainerRun(runId, {
      repoUrl: row.repo_url,
      baseBranch: row.base_branch,
      targetBranch: row.target_branch,
      commands: parseRequestedCommands(row),
      timeoutSeconds: row.timeout_seconds,
    }, ctx)
  }

  const updated = await getRunRow(runId, ctx)
  const updatedApproval = await getRunApproval(runId, ctx)
  return jsonResponse({
    run: {
      ...mapRun(updated),
      approval: updatedApproval,
    },
  })
}

// POST /api/v1/codebase/runs/:id/deny
export async function denyCodebaseRun(
  runId: string,
  payload: { note?: string } | undefined,
  ctx: RequestContext,
): Promise<Response> {
  ensureApproverRole(ctx)
  const row = await getRunRow(runId, ctx)
  if (TERMINAL_RUN_STATUSES.has(row.status)) {
    throw new BadRequestException('Cannot deny a completed run')
  }

  const approval = await getRunApproval(runId, ctx)
  if (!approval.required) {
    throw new BadRequestException('Run does not require human approval')
  }
  if (approval.state !== 'pending') {
    throw new BadRequestException('Approval decision already recorded')
  }

  await appendEvent(runId, {
    level: 'warn',
    eventType: 'run.approval.denied',
    message: 'Run denied by human reviewer.',
    payload: {
      deniedByUserId: ctx.userId,
      approverRole: ctx.user.role,
      note: payload?.note ?? null,
    },
  }, ctx)

  const canceledAt = nowIso()
  await ctx.env.DB.prepare(
    'UPDATE codebase_runs SET status = ?, canceled_at = ?, completed_at = ?, error_message = ? WHERE id = ? AND user_id = ?',
  ).bind('canceled', canceledAt, canceledAt, 'Denied by human approver', runId, ctx.userId).run()

  await appendEvent(runId, {
    level: 'warn',
    eventType: 'run.canceled',
    message: 'Run canceled after denial.',
  }, ctx)

  const updated = await getRunRow(runId, ctx)
  const updatedApproval = await getRunApproval(runId, ctx)
  return jsonResponse({
    run: {
      ...mapRun(updated),
      approval: updatedApproval,
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
