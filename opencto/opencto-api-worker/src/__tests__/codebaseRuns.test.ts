import { afterEach, describe, expect, it } from 'vitest'
import worker from '../index'
import { __setContainerDispatcherForTests } from '../codebaseRuns'
import type { Env } from '../types'

type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'timed_out'

type RunRow = {
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

type EventRow = {
  id: string
  run_id: string
  seq: number
  level: 'system' | 'info' | 'warn' | 'error'
  event_type: string
  message: string
  payload_json: string | null
  created_at: string
}

class MockD1Database {
  private runs = new Map<string, RunRow>()
  private events: EventRow[] = []

  prepare(sql: string): MockPreparedStatement {
    return new MockPreparedStatement(this, sql)
  }

  setRunStatus(runId: string, status: RunStatus): void {
    const run = this.runs.get(runId)
    if (!run) return
    run.status = status
  }

  countEvents(runId: string): number {
    return this.events.filter((event) => event.run_id === runId).length
  }

  getFirstRunId(): string {
    const first = this.runs.values().next().value as RunRow | undefined
    return first?.id ?? ''
  }

  executeRun(sql: string, args: unknown[]): void {
    const normalized = normalizeSql(sql)
    if (normalized.startsWith('create table') || normalized.startsWith('create index') || normalized.startsWith('alter table')) return

    if (normalized.startsWith('insert into codebase_runs')) {
      const row: RunRow = {
        id: String(args[0]),
        user_id: String(args[1]),
        trace_id: args[2] == null ? null : String(args[2]),
        repo_url: String(args[3]),
        repo_full_name: args[4] == null ? null : String(args[4]),
        base_branch: String(args[5]),
        target_branch: String(args[6]),
        status: String(args[7]) as RunStatus,
        requested_commands_json: String(args[8]),
        command_allowlist_version: String(args[9]),
        timeout_seconds: Number(args[10]),
        created_at: String(args[11]),
        started_at: null,
        completed_at: null,
        canceled_at: null,
        error_message: null,
      }
      this.runs.set(row.id, row)
      return
    }

    if (normalized.startsWith('insert into codebase_run_events')) {
      const row: EventRow = {
        id: String(args[0]),
        run_id: String(args[1]),
        seq: Number(args[2]),
        level: String(args[3]) as EventRow['level'],
        event_type: String(args[4]),
        message: String(args[5]),
        payload_json: args[6] == null ? null : String(args[6]),
        created_at: String(args[7]),
      }
      this.events.push(row)
      return
    }

    if (normalized.startsWith('update codebase_runs set status = ?, canceled_at = ?, completed_at = ?, error_message = ?')) {
      const [status, canceledAt, completedAt, errorMessage, runId, userId] = args
      const run = this.runs.get(String(runId))
      if (!run || run.user_id !== String(userId)) return
      run.status = String(status) as RunStatus
      run.canceled_at = String(canceledAt)
      run.completed_at = String(completedAt)
      run.error_message = String(errorMessage)
      return
    }

    if (normalized.startsWith('update codebase_runs set status = ?')) {
      const [status, canceledAt, completedAt, runId, userId] = args
      const run = this.runs.get(String(runId))
      if (!run || run.user_id !== String(userId)) return
      run.status = String(status) as RunStatus
      run.canceled_at = String(canceledAt)
      run.completed_at = String(completedAt)
      return
    }

    if (normalized.startsWith('update codebase_runs set status = ?, started_at = coalesce(started_at, ?)')) {
      const [status, startedAt, runId, userId] = args
      const run = this.runs.get(String(runId))
      if (!run || run.user_id !== String(userId)) return
      run.status = String(status) as RunStatus
      run.started_at = run.started_at ?? String(startedAt)
      run.error_message = null
      return
    }

    if (normalized.startsWith('update codebase_runs set status = ?, completed_at = ?, error_message = ?')) {
      const [status, completedAt, errorMessage, runId, userId] = args
      const run = this.runs.get(String(runId))
      if (!run || run.user_id !== String(userId)) return
      run.status = String(status) as RunStatus
      run.completed_at = String(completedAt)
      run.error_message = errorMessage == null ? null : String(errorMessage)
      return
    }

    throw new Error(`Unhandled run SQL: ${sql}`)
  }

  executeFirst<T>(sql: string, args: unknown[]): T | null {
    const normalized = normalizeSql(sql)

    if (normalized.startsWith('select id, user_id, trace_id, repo_url, repo_full_name')) {
      if (normalized.includes('where user_id = ? order by created_at desc limit ? offset ?')) {
        const [userId, limit, offset] = args
        const rows = Array.from(this.runs.values())
          .filter((run) => run.user_id === String(userId))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(Number(offset), Number(offset) + Number(limit))
        return { results: rows.map((row) => structuredClone(row) as T) } as T
      }
      const [runId, userId] = args
      const row = this.runs.get(String(runId))
      if (!row || row.user_id !== String(userId)) return null
      return structuredClone(row) as T
    }

    if (normalized.startsWith('select coalesce(max(seq), 0) as max_seq from codebase_run_events')) {
      const [runId] = args
      const seqs = this.events.filter((event) => event.run_id === String(runId)).map((event) => event.seq)
      const maxSeq = seqs.length > 0 ? Math.max(...seqs) : 0
      return { max_seq: maxSeq } as T
    }

    if (normalized.startsWith('select count(*) as count from codebase_run_events where run_id = ?')) {
      const [runId] = args
      return { count: this.events.filter((event) => event.run_id === String(runId)).length } as T
    }

    if (normalized.startsWith('select count(*) as count from codebase_run_artifacts where run_id = ?')) {
      return { count: 0 } as T
    }

    if (normalized.includes("from codebase_runs where user_id = ? and status in ('queued', 'running')")) {
      const [userId] = args
      const count = Array.from(this.runs.values()).filter((run) => run.user_id === String(userId) && (run.status === 'queued' || run.status === 'running')).length
      return { count } as T
    }

    if (normalized.startsWith('select count(*) as count from codebase_runs where user_id = ? and created_at >= ?')) {
      const [userId, since] = args
      const count = Array.from(this.runs.values()).filter((run) => run.user_id === String(userId) && run.created_at >= String(since)).length
      return { count } as T
    }

    throw new Error(`Unhandled first SQL: ${sql}`)
  }

  executeAll<T>(sql: string, args: unknown[]): { results: T[] } {
    const normalized = normalizeSql(sql)

    if (normalized.startsWith('select id, user_id, trace_id, repo_url, repo_full_name') && normalized.includes('where user_id = ? order by created_at desc limit ? offset ?')) {
      const [userId, limit, offset] = args
      const rows = Array.from(this.runs.values())
        .filter((run) => run.user_id === String(userId))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(Number(offset), Number(offset) + Number(limit))
      return { results: rows.map((row) => structuredClone(row) as T) }
    }

    if (normalized.startsWith('select id, run_id, seq, level, event_type, message, payload_json, created_at from codebase_run_events')) {
      const [runId, afterSeq, limit] = args
      const filtered = this.events
        .filter((event) => event.run_id === String(runId) && event.seq > Number(afterSeq))
        .sort((a, b) => a.seq - b.seq)
        .slice(0, Number(limit))
      return { results: filtered.map((event) => structuredClone(event) as T) }
    }

    if (normalized.startsWith("select event_type, payload_json, created_at from codebase_run_events where run_id = ? and event_type in ('run.approval_required', 'run.approval.approved', 'run.approval.denied')")) {
      const [runId] = args
      const filtered = this.events
        .filter((event) => event.run_id === String(runId) && (
          event.event_type === 'run.approval_required'
          || event.event_type === 'run.approval.approved'
          || event.event_type === 'run.approval.denied'
        ))
        .sort((a, b) => a.seq - b.seq)
        .map((event) => ({
          event_type: event.event_type,
          payload_json: event.payload_json,
          created_at: event.created_at,
        }) as T)
      return { results: filtered }
    }

    if (normalized.startsWith('select status, started_at, completed_at from codebase_runs where user_id = ? and created_at >= ?')) {
      const [userId, since] = args
      const filtered = Array.from(this.runs.values())
        .filter((run) => run.user_id === String(userId) && run.created_at >= String(since))
        .map((run) => ({
          status: run.status,
          started_at: run.started_at,
          completed_at: run.completed_at,
        }) as T)
      return { results: filtered }
    }

    throw new Error(`Unhandled all SQL: ${sql}`)
  }
}

class MockPreparedStatement {
  private args: unknown[] = []

  constructor(private readonly db: MockD1Database, private readonly sql: string) {}

  bind(...args: unknown[]): MockPreparedStatement {
    this.args = args
    return this
  }

  async run(): Promise<{ success: true }> {
    this.db.executeRun(this.sql, this.args)
    return { success: true }
  }

  async first<T>(): Promise<T | null> {
    return this.db.executeFirst<T>(this.sql, this.args)
  }

  async all<T>(): Promise<{ results: T[] }> {
    return this.db.executeAll<T>(this.sql, this.args)
  }
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase()
}

function createMockEnv(overrides: Partial<Env> = {}, db = new MockD1Database()): Env {
  return {
    DB: db as unknown as D1Database,
    OPENAI_API_KEY: 'sk-test-mock',
    STRIPE_SECRET_KEY: 'sk_test_mock',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_mock',
    JWT_SECRET: 'jwt_secret_mock',
    WEBAUTHN_RP_ID: 'opencto.works',
    WEBAUTHN_RP_NAME: 'OpenCTO',
    ENVIRONMENT: 'development',
    VERCEL_TOKEN: 'vercel-test-mock',
    CF_API_TOKEN: 'cf-test-mock',
    CF_ACCOUNT_ID: 'cf-account-mock',
    GITHUB_TOKEN: 'github-test-mock',
    GITHUB_OAUTH_CLIENT_ID: 'github-oauth-client-id-mock',
    GITHUB_OAUTH_CLIENT_SECRET: 'github-oauth-client-secret-mock',
    API_BASE_URL: 'https://api.opencto.works',
    OPENCTO_AGENT_BASE_URL: 'https://cloud-services-api.opencto.works',
    APP_BASE_URL: 'https://app.opencto.works',
    CODEBASE_EXECUTOR: undefined,
    CODEBASE_EXECUTION_MODE: 'stub',
    CODEBASE_DAILY_RUN_LIMIT: '100',
    CODEBASE_MAX_CONCURRENT_RUNS: '2',
    ...overrides,
  }
}

afterEach(() => {
  __setContainerDispatcherForTests(null)
})

async function createRun(env: Env, body?: Record<string, unknown>): Promise<Response> {
  return await worker.fetch(
    new Request('https://api.opencto.works/api/v1/codebase/runs', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer demo-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body ?? {
        repoUrl: 'https://github.com/Hey-Salad/CTO-AI.git',
        commands: ['git clone https://github.com/Hey-Salad/CTO-AI.git', 'npm run build'],
      }),
    }),
    env,
  )
}

describe('Codebase run endpoints', () => {
  it('POST /api/v1/codebase/runs succeeds and persists normalized commands', async () => {
    const db = new MockD1Database()
    const env = createMockEnv({}, db)

    const res = await createRun(env, {
      repoUrl: 'https://github.com/Hey-Salad/CTO-AI.git',
      commands: ['   git   clone   https://github.com/Hey-Salad/CTO-AI.git  ', 'npm    run   build'],
      timeoutSeconds: 99999,
    })
    const body = await res.json() as { run: { requestedCommands: string[]; timeoutSeconds: number } }

    expect(res.status).toBe(201)
    expect(body.run.requestedCommands).toEqual([
      'git clone https://github.com/Hey-Salad/CTO-AI.git',
      'npm run build',
    ])
    expect(body.run.timeoutSeconds).toBe(1800)
  })

  it('POST /api/v1/codebase/runs rejects disallowed or chained commands', async () => {
    const env = createMockEnv()

    const res = await createRun(env, {
      repoUrl: 'https://github.com/Hey-Salad/CTO-AI.git',
      commands: ['npm run build && echo bad'],
    })
    const body = await res.json() as { code?: string; status?: number; error?: string }

    expect(res.status).toBe(400)
    expect(body.code).toBe('BAD_REQUEST')
    expect(body.status).toBe(400)
    expect(body.error).toContain('Shell chaining')
  })

  it('POST /api/v1/codebase/runs blocks unsafe repo URLs', async () => {
    const env = createMockEnv()

    const res = await createRun(env, {
      repoUrl: 'http://localhost:3000/private.git',
      commands: ['npm run build'],
    })
    const body = await res.json() as { code?: string; status?: number; details?: { guardrailCodes?: string[] } }

    expect(res.status).toBe(403)
    expect(body.code).toBe('FORBIDDEN')
    expect(body.status).toBe(403)
    expect(body.details?.guardrailCodes).toContain('UNSAFE_REPO_URL')
  })

  it('POST /api/v1/codebase/runs rejects non-GitHub repo URLs', async () => {
    const env = createMockEnv()

    const res = await createRun(env, {
      repoUrl: 'https://gitlab.com/Hey-Salad/CTO-AI.git',
      commands: ['npm run build'],
    })
    const body = await res.json() as { code?: string; status?: number; error?: string }

    expect(res.status).toBe(400)
    expect(body.code).toBe('BAD_REQUEST')
    expect(body.status).toBe(400)
    expect(body.error).toContain('github.com')
  })

  it('POST /api/v1/codebase/runs rejects unauthorized requests', async () => {
    const env = createMockEnv({ ENVIRONMENT: 'production' })

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/codebase/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          repoUrl: 'https://github.com/Hey-Salad/CTO-AI.git',
          commands: ['npm run build'],
        }),
      }),
      env,
    )

    expect(res.status).toBe(401)
  })

  it('POST /api/v1/codebase/runs returns quota error when concurrent cap is exceeded', async () => {
    const db = new MockD1Database()
    const env = createMockEnv({ CODEBASE_MAX_CONCURRENT_RUNS: '1' }, db)
    await createRun(env)

    const res = await createRun(env)
    const body = await res.json() as { code?: string; status?: number; error?: string }

    expect(res.status).toBe(429)
    expect(body.code).toBe('CODEBASE_CONCURRENCY_LIMIT')
    expect(body.status).toBe(429)
    expect(body.error).toContain('Concurrent run quota')
  })

  it('POST /api/v1/codebase/runs returns quota error when daily cap is exceeded', async () => {
    const db = new MockD1Database()
    const env = createMockEnv({
      CODEBASE_MAX_CONCURRENT_RUNS: '5',
      CODEBASE_DAILY_RUN_LIMIT: '1',
    }, db)
    await createRun(env, {
      repoUrl: 'https://github.com/Hey-Salad/CTO-AI.git',
      commands: ['npm run build'],
    })

    const res = await createRun(env, {
      repoUrl: 'https://github.com/Hey-Salad/CTO-AI.git',
      commands: ['npm run build'],
    })
    const body = await res.json() as { code?: string; status?: number; error?: string }

    expect(res.status).toBe(429)
    expect(body.code).toBe('CODEBASE_DAILY_LIMIT')
    expect(body.status).toBe(429)
    expect(body.error).toContain('Daily run quota')
  })

  it('POST /api/v1/codebase/runs rejects invalid timeout payloads', async () => {
    const env = createMockEnv()

    const res = await createRun(env, {
      repoUrl: 'https://github.com/Hey-Salad/CTO-AI.git',
      commands: ['npm run build'],
      timeoutSeconds: 'invalid',
    })

    expect(res.status).toBe(400)
  })

  it('POST /api/v1/codebase/runs returns NOT_IMPLEMENTED in container mode', async () => {
    const env = createMockEnv({ CODEBASE_EXECUTION_MODE: 'container' })

    const res = await createRun(env)
    const body = await res.json() as { code?: string; status?: number }

    expect(res.status).toBe(501)
    expect(body.code).toBe('NOT_IMPLEMENTED')
    expect(body.status).toBe(501)
  })

  it('POST /api/v1/codebase/runs creates pending human approval for high-risk runs', async () => {
    const env = createMockEnv()

    const res = await createRun(env, {
      repoUrl: 'https://github.com/Hey-Salad/CTO-AI.git',
      commands: ['git push origin main'],
    })
    const body = await res.json() as { run: { status: string; approval?: { state?: string; required?: boolean } } }

    expect(res.status).toBe(201)
    expect(body.run.status).toBe('queued')
    expect(body.run.approval?.required).toBe(true)
    expect(body.run.approval?.state).toBe('pending')
  })

  it('POST /api/v1/codebase/runs/:id/approve executes pending run in container mode', async () => {
    const db = new MockD1Database()
    const env = createMockEnv(
      {
        CODEBASE_EXECUTION_MODE: 'container',
        CODEBASE_EXECUTOR: {} as DurableObjectNamespace,
      },
      db,
    )

    __setContainerDispatcherForTests(async () => ({
      status: 'succeeded',
      logs: [{ level: 'info', message: 'approved run executed' }],
    }))

    const created = await createRun(env, {
      repoUrl: 'https://github.com/Hey-Salad/CTO-AI.git',
      commands: ['git push origin main'],
    })
    const createdBody = await created.json() as { run: { id: string } }

    const approveRes = await worker.fetch(
      new Request(`https://api.opencto.works/api/v1/codebase/runs/${createdBody.run.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ note: 'approved in test' }),
      }),
      env,
    )
    const approveBody = await approveRes.json() as { run: { status: string; approval?: { state?: string } } }

    expect(approveRes.status).toBe(200)
    expect(approveBody.run.status).toBe('succeeded')
    expect(approveBody.run.approval?.state).toBe('approved')
  })

  it('POST /api/v1/codebase/runs/:id/deny cancels pending run', async () => {
    const env = createMockEnv()

    const created = await createRun(env, {
      repoUrl: 'https://github.com/Hey-Salad/CTO-AI.git',
      commands: ['git push origin main'],
    })
    const createdBody = await created.json() as { run: { id: string } }

    const denyRes = await worker.fetch(
      new Request(`https://api.opencto.works/api/v1/codebase/runs/${createdBody.run.id}/deny`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ note: 'deny in test' }),
      }),
      env,
    )
    const denyBody = await denyRes.json() as { run: { status: string; approval?: { state?: string } } }

    expect(denyRes.status).toBe(200)
    expect(denyBody.run.status).toBe('canceled')
    expect(denyBody.run.approval?.state).toBe('denied')
  })

  it('POST /api/v1/codebase/runs dispatches to container in container mode', async () => {
    const db = new MockD1Database()
    const env = createMockEnv({
      CODEBASE_EXECUTION_MODE: 'container',
      CODEBASE_EXECUTOR: {} as DurableObjectNamespace,
    }, db)

    __setContainerDispatcherForTests(async () => ({
      status: 'succeeded',
      logs: [
        { level: 'system', message: 'container accepted run' },
        { level: 'info', message: 'executed npm run build' },
      ],
    }))

    const res = await createRun(env)
    const body = await res.json() as { run: { status: RunStatus } }
    const runId = db.getFirstRunId()

    expect(res.status).toBe(201)
    expect(body.run.status).toBe('succeeded')
    expect(db.countEvents(runId)).toBe(6)
  })

  it('GET /api/v1/codebase/runs/:id returns run when found', async () => {
    const db = new MockD1Database()
    const env = createMockEnv({}, db)
    const created = await createRun(env)
    const createdBody = await created.json() as { run: { id: string } }

    const res = await worker.fetch(
      new Request(`https://api.opencto.works/api/v1/codebase/runs/${createdBody.run.id}`, {
        headers: { Authorization: 'Bearer demo-token' },
      }),
      env,
    )
    const body = await res.json() as { run: { id: string } }

    expect(res.status).toBe(200)
    expect(body.run.id).toBe(createdBody.run.id)
  })

  it('GET /api/v1/codebase/runs returns runs in reverse chronological order', async () => {
    const db = new MockD1Database()
    const env = createMockEnv({ CODEBASE_MAX_CONCURRENT_RUNS: '5' }, db)

    const first = await createRun(env, {
      repoUrl: 'https://github.com/Hey-Salad/CTO-AI.git',
      commands: ['npm run build'],
    })
    const second = await createRun(env, {
      repoUrl: 'https://github.com/Hey-Salad/OpenCTO.git',
      commands: ['npm run build'],
    })

    const firstBody = await first.json() as { run: { id: string } }
    const secondBody = await second.json() as { run: { id: string } }

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/codebase/runs?limit=20&offset=0', {
        headers: { Authorization: 'Bearer demo-token' },
      }),
      env,
    )
    const body = await res.json() as { runs: Array<{ id: string }>; nextOffset: number | null }

    expect(res.status).toBe(200)
    expect(body.runs.map((run) => run.id)).toEqual([secondBody.run.id, firstBody.run.id])
    expect(body.nextOffset).toBeNull()
  })

  it('GET /api/v1/codebase/runs/:id returns 404 when missing', async () => {
    const env = createMockEnv()

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/codebase/runs/missing', {
        headers: { Authorization: 'Bearer demo-token' },
      }),
      env,
    )

    expect(res.status).toBe(404)
  })

  it('GET /api/v1/codebase/metrics returns per-user totals for the last 24 hours', async () => {
    const db = new MockD1Database()
    const env = createMockEnv({ CODEBASE_MAX_CONCURRENT_RUNS: '5' }, db)

    const first = await createRun(env)
    const second = await createRun(env, {
      repoUrl: 'https://github.com/Hey-Salad/OpenCTO.git',
      commands: ['npm run build'],
    })
    const denied = await createRun(env, {
      repoUrl: 'https://github.com/Hey-Salad/OpenCTO.git',
      commands: ['git push origin main'],
    })

    const firstBody = await first.json() as { run: { id: string } }
    const secondBody = await second.json() as { run: { id: string } }
    const deniedBody = await denied.json() as { run: { id: string } }

    db.setRunStatus(firstBody.run.id, 'succeeded')
    db.setRunStatus(secondBody.run.id, 'failed')

    await worker.fetch(
      new Request(`https://api.opencto.works/api/v1/codebase/runs/${deniedBody.run.id}/deny`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer demo-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ note: 'deny in test' }),
      }),
      env,
    )

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/codebase/metrics', {
        headers: { Authorization: 'Bearer demo-token' },
      }),
      env,
    )
    const body = await res.json() as {
      totals: { created: number; succeeded: number; failed: number; canceled: number; avgDurationMs: number }
      windowHours: number
    }

    expect(res.status).toBe(200)
    expect(body.windowHours).toBe(24)
    expect(body.totals.created).toBe(3)
    expect(body.totals.succeeded).toBe(1)
    expect(body.totals.failed).toBe(1)
    expect(body.totals.canceled).toBe(1)
    expect(body.totals.avgDurationMs).toBe(0)
  })

  it('GET /api/v1/codebase/runs/:id/events returns ordered events', async () => {
    const db = new MockD1Database()
    const env = createMockEnv({}, db)
    const created = await createRun(env)
    const createdBody = await created.json() as { run: { id: string } }

    await worker.fetch(
      new Request(`https://api.opencto.works/api/v1/codebase/runs/${createdBody.run.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: 'Bearer demo-token' },
      }),
      env,
    )

    const res = await worker.fetch(
      new Request(`https://api.opencto.works/api/v1/codebase/runs/${createdBody.run.id}/events?afterSeq=0&limit=50`, {
        headers: { Authorization: 'Bearer demo-token' },
      }),
      env,
    )
    const body = await res.json() as { events: Array<{ seq: number }> }

    expect(res.status).toBe(200)
    expect(body.events.map((event) => event.seq)).toEqual([1, 2, 3])
  })

  it('POST /api/v1/codebase/runs/:id/cancel transitions queued/running to canceled', async () => {
    const db = new MockD1Database()
    const env = createMockEnv({}, db)
    const created = await createRun(env)
    const createdBody = await created.json() as { run: { id: string } }

    db.setRunStatus(createdBody.run.id, 'running')

    const res = await worker.fetch(
      new Request(`https://api.opencto.works/api/v1/codebase/runs/${createdBody.run.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: 'Bearer demo-token' },
      }),
      env,
    )
    const body = await res.json() as { run: { status: RunStatus } }

    expect(res.status).toBe(200)
    expect(body.run.status).toBe('canceled')
  })

  it('POST /api/v1/codebase/runs/:id/cancel is no-op for terminal status', async () => {
    const db = new MockD1Database()
    const env = createMockEnv({}, db)
    const created = await createRun(env)
    const createdBody = await created.json() as { run: { id: string; status: RunStatus } }

    db.setRunStatus(createdBody.run.id, 'succeeded')
    const beforeEventCount = db.countEvents(createdBody.run.id)

    const res = await worker.fetch(
      new Request(`https://api.opencto.works/api/v1/codebase/runs/${createdBody.run.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: 'Bearer demo-token' },
      }),
      env,
    )
    const body = await res.json() as { run: { status: RunStatus } }

    expect(res.status).toBe(200)
    expect(body.run.status).toBe('succeeded')
    expect(db.countEvents(createdBody.run.id)).toBe(beforeEventCount)
  })
})
