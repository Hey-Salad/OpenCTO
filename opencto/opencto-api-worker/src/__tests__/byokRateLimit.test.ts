import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../index'
import type { Env } from '../types'

describe('BYOK and rate limiting', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('supports provider key CRUD with masked key hints', async () => {
    const db = new MockD1Database()
    db.setWorkspaceAccess('ws_demo', true)
    const env = createMockEnv({ DB: db as unknown as D1Database })

    const upsertRes = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/llm/keys/openai', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer demo-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: 'sk-openai-test-12345678',
          workspaceId: 'ws_demo',
        }),
      }),
      env,
    )
    expect(upsertRes.status).toBe(200)

    const listRes = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/llm/keys?workspaceId=ws_demo', {
        headers: { Authorization: 'Bearer demo-token' },
      }),
      env,
    )
    const listBody = await listRes.json() as {
      keys: Array<{ provider: string; keyHint: string }>
    }
    expect(listRes.status).toBe(200)
    expect(listBody.keys).toHaveLength(1)
    expect(listBody.keys[0]?.provider).toBe('openai')
    expect(listBody.keys[0]?.keyHint).toBe('****5678')

    const deleteRes = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/llm/keys/openai?workspaceId=ws_demo', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer demo-token' },
      }),
      env,
    )
    const deleteBody = await deleteRes.json() as { deleted: boolean }
    expect(deleteRes.status).toBe(200)
    expect(deleteBody.deleted).toBe(true)
  })

  it('denies BYOK writes for inaccessible workspaces', async () => {
    const db = new MockD1Database()
    db.setWorkspaceAccess('other_workspace', false)
    const env = createMockEnv({ DB: db as unknown as D1Database })

    const res = await worker.fetch(
      new Request('https://api.opencto.works/api/v1/llm/keys/openai', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer demo-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: 'sk-openai-test-99999999',
          workspaceId: 'other_workspace',
        }),
      }),
      env,
    )
    const body = await res.json() as { code?: string; status?: number; error?: string }
    expect(res.status).toBe(403)
    expect(body.code).toBe('FORBIDDEN')
    expect(body.status).toBe(403)
    expect(body.error).toContain('Workspace access denied')
  })

  it('enforces realtime token mint rate limit', async () => {
    const env = createMockEnv({
      RATE_LIMIT_REALTIME_PER_MINUTE: '1',
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          value: 'rt_secret_123',
          expires_at: Math.floor(Date.now() / 1000) + 300,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )

    const req = new Request('https://api.opencto.works/api/v1/realtime/token', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer demo-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-realtime-1.5', workspaceId: 'default' }),
    })

    const first = await worker.fetch(req.clone(), env)
    expect(first.status).toBe(200)

    const second = await worker.fetch(req.clone(), env)
    const secondBody = await second.json() as { code?: string; status?: number }
    expect(second.status).toBe(429)
    expect(secondBody.code).toBe('QUOTA_EXCEEDED')
    expect(secondBody.status).toBe(429)
  })
})

class MockD1Database {
  private providerKeys = new Map<string, ProviderKeyRow>()
  private buckets = new Map<string, { count: number; expiresAt: string }>()
  private workspaceAccess = new Map<string, boolean>()

  setWorkspaceAccess(workspaceId: string, allowed: boolean): void {
    this.workspaceAccess.set(workspaceId, allowed)
  }

  prepare(sql: string): MockD1Statement {
    return new MockD1Statement(this, normalizeSql(sql))
  }

  run(sql: string, args: unknown[]): { meta: { changes: number } } {
    if (sql.startsWith('create table') || sql.startsWith('create index') || sql.startsWith('create unique index')) {
      return { meta: { changes: 0 } }
    }

    if (sql.startsWith('insert into user_provider_keys')) {
      const [id, userId, workspaceId, provider, keyHint, encryptedKey, iv, createdAt, updatedAt] = args
      const idValue = String(id ?? '')
      const userIdValue = String(userId ?? '')
      const workspaceIdValue = String(workspaceId ?? '')
      const providerValue = String(provider ?? '')
      const keyHintValue = String(keyHint ?? '')
      const encryptedKeyValue = String(encryptedKey ?? '')
      const ivValue = String(iv ?? '')
      const createdAtValue = String(createdAt ?? '')
      const updatedAtValue = String(updatedAt ?? '')
      this.providerKeys.set(idValue, {
        id: idValue,
        user_id: userIdValue,
        workspace_id: workspaceIdValue,
        provider: providerValue,
        key_hint: keyHintValue,
        encrypted_key_b64: encryptedKeyValue,
        iv_b64: ivValue,
        created_at: createdAtValue,
        updated_at: updatedAtValue,
      })
      return { meta: { changes: 1 } }
    }

    if (sql.startsWith('delete from user_provider_keys where id = ?')) {
      const id = String(args[0] ?? '')
      const existed = this.providerKeys.delete(id)
      return { meta: { changes: existed ? 1 : 0 } }
    }

    if (sql.startsWith('insert into api_rate_limits')) {
      const [bucketKey, expiresAt] = args
      const bucketKeyValue = String(bucketKey ?? '')
      const expiresAtValue = String(expiresAt ?? '')
      const current = this.buckets.get(bucketKeyValue)
      this.buckets.set(bucketKeyValue, {
        count: (current?.count ?? 0) + 1,
        expiresAt: expiresAtValue,
      })
      return { meta: { changes: 1 } }
    }

    if (sql.startsWith('delete from api_rate_limits where expires_at < ?')) {
      const threshold = String(args[0] ?? '')
      let changes = 0
      for (const [key, row] of this.buckets) {
        if (row.expiresAt < threshold) {
          this.buckets.delete(key)
          changes += 1
        }
      }
      return { meta: { changes } }
    }

    throw new Error(`Unhandled run SQL: ${sql}`)
  }

  first<T>(sql: string, args: unknown[]): T | null {
    if (sql.startsWith('select encrypted_key_b64, iv_b64 from user_provider_keys where id = ?')) {
      const id = String(args[0] ?? '')
      const row = this.providerKeys.get(id)
      if (!row) return null
      return {
        encrypted_key_b64: row.encrypted_key_b64,
        iv_b64: row.iv_b64,
      } as T
    }

    if (sql.startsWith('select count from api_rate_limits where bucket_key = ?')) {
      const key = String(args[0] ?? '')
      const row = this.buckets.get(key)
      return { count: row?.count ?? 0 } as T
    }

    if (sql.startsWith('select count(*) as count from workspace_members where workspace_id = ? and user_id = ?')) {
      const workspaceId = String(args[0] ?? '')
      const allowed = this.workspaceAccess.get(workspaceId)
      return { count: allowed === true ? 1 : 0 } as T
    }

    if (sql.startsWith('select count(*) as count from workspaces where id = ? and owner_user_id = ?')) {
      const workspaceId = String(args[0] ?? '')
      const allowed = this.workspaceAccess.get(workspaceId)
      return { count: allowed === true ? 1 : 0 } as T
    }

    if (sql.startsWith('select count(*) as count from user_profiles where user_id = ? and workspace_id = ?')) {
      const workspaceId = String(args[1] ?? '')
      const allowed = this.workspaceAccess.get(workspaceId)
      return { count: allowed === true ? 1 : 0 } as T
    }

    throw new Error(`Unhandled first SQL: ${sql}`)
  }

  all<T>(sql: string, args: unknown[]): { results: T[] } {
    if (sql.startsWith('select id, user_id, workspace_id, provider, key_hint, encrypted_key_b64, iv_b64, created_at, updated_at from user_provider_keys')) {
      const [userId, workspaceId] = args as string[]
      const results = [...this.providerKeys.values()]
        .filter((row) => row.user_id === userId && row.workspace_id === workspaceId)
        .sort((a, b) => a.provider.localeCompare(b.provider))
        .map((row) => ({ ...row })) as T[]
      return { results }
    }

    throw new Error(`Unhandled all SQL: ${sql}`)
  }
}

class MockD1Statement {
  private args: unknown[] = []

  constructor(
    private readonly db: MockD1Database,
    private readonly sql: string,
  ) {}

  bind(...args: unknown[]): MockD1Statement {
    this.args = args
    return this
  }

  run(): Promise<{ meta: { changes: number } }> {
    return Promise.resolve(this.db.run(this.sql, this.args))
  }

  first<T>(): Promise<T | null> {
    return Promise.resolve(this.db.first<T>(this.sql, this.args))
  }

  all<T>(): Promise<{ results: T[] }> {
    return Promise.resolve(this.db.all<T>(this.sql, this.args))
  }
}

function normalizeSql(sql: string): string {
  return sql.toLowerCase().replace(/\s+/g, ' ').trim()
}

interface ProviderKeyRow {
  id: string
  user_id: string
  workspace_id: string
  provider: string
  key_hint: string
  encrypted_key_b64: string
  iv_b64: string
  created_at: string
  updated_at: string
}

function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: new MockD1Database() as unknown as D1Database,
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
    ...overrides,
  }
}
