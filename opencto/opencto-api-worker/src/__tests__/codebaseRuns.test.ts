import { describe, expect, it } from 'vitest'
import worker from '../index'
import type { Env } from '../types'

type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'timed_out'

type RunRow = {
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
    if (normalized.startsWith('create table') || normalized.startsWith('create index')) return

    if (normalized.startsWith('insert into codebase_runs')) {
      const row: RunRow = {
        id: String(args[0]),
        user_id: String(args[1]),
        repo_url: String(args[2]),
        repo_full_name: args[3] == null ? null : String(args[3]),
        base_branch: String(args[4]),
        target_branch: String(args[5]),
        status: String(args[6]) as RunStatus,
        requested_commands_json: String(args[7]),
        command_allowlist_version: String(args[8]),
        timeout_seconds: Number(args[9]),
        created_at: String(args[10]),
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

    if (normalized.startsWith('update codebase_runs set status = ?')) {
      const [status, canceledAt, completedAt, runId, userId] = args
      const run = this.runs.get(String(runId))
      if (!run || run.user_id !== String(userId)) return
      run.status = String(status) as RunStatus
      run.canceled_at = String(canceledAt)
      run.completed_at = String(completedAt)
      return
    }

    throw new Error(`Unhandled run SQL: ${sql}`)
  }

  executeFirst<T>(sql: string, args: unknown[]): T | null {
    const normalized = normalizeSql(sql)

    if (normalized.startsWith('select id, user_id, repo_url, repo_full_name')) {
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

    if (normalized.startsWith('select id, run_id, seq, level, event_type, message, payload_json, created_at from codebase_run_events')) {
      const [runId, afterSeq, limit] = args
      const filtered = this.events
        .filter((event) => event.run_id === String(runId) && event.seq > Number(afterSeq))
        .sort((a, b) => a.seq - b.seq)
        .slice(0, Number(limit))
      return { results: filtered.map((event) => structuredClone(event) as T) }
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
    CODEBASE_EXECUTION_MODE: 'stub',
    CODEBASE_DAILY_RUN_LIMIT: '100',
    CODEBASE_MAX_CONCURRENT_RUNS: '2',
    ...overrides,
  }
}

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
