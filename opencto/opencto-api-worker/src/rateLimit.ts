import type { RequestContext } from './types'
import { TooManyRequestsException } from './errors'

let schemaReady = false

export interface RateLimitOptions {
  limit: number
  windowSeconds: number
  workspaceId?: string
}

export async function enforceRateLimit(
  ctx: RequestContext,
  bucket: string,
  options: RateLimitOptions,
): Promise<void> {
  if (!hasD1Binding(ctx)) return
  const limit = Math.max(1, Math.trunc(options.limit))
  const windowSeconds = Math.max(1, Math.trunc(options.windowSeconds))
  const nowMs = Date.now()
  const windowMs = windowSeconds * 1000
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs
  const windowEndMs = windowStartMs + windowMs
  const scope = options.workspaceId ? `${ctx.userId}:${options.workspaceId}` : ctx.userId
  const key = `${scope}:${bucket}:${windowStartMs}`
  const nowIso = new Date(nowMs).toISOString()
  const expiresAt = new Date(windowEndMs).toISOString()

  await ensureSchema(ctx)
  await ctx.env.DB.prepare(
    `INSERT INTO api_rate_limits (bucket_key, count, expires_at, created_at, updated_at)
     VALUES (?, 1, ?, ?, ?)
     ON CONFLICT(bucket_key) DO UPDATE SET
       count = count + 1,
       updated_at = excluded.updated_at`,
  ).bind(key, expiresAt, nowIso, nowIso).run()

  const row = await ctx.env.DB.prepare(
    'SELECT count FROM api_rate_limits WHERE bucket_key = ?',
  ).bind(key).first<{ count: number }>()
  const count = row?.count ?? 0

  // Opportunistic cleanup of expired buckets.
  if (Math.random() < 0.05) {
    await ctx.env.DB.prepare(
      'DELETE FROM api_rate_limits WHERE expires_at < ?',
    ).bind(nowIso).run()
  }

  if (count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowEndMs - nowMs) / 1000))
    throw new TooManyRequestsException('Rate limit exceeded', {
      bucket,
      limit,
      windowSeconds,
      retryAfterSeconds,
    })
  }
}

async function ensureSchema(ctx: RequestContext): Promise<void> {
  if (schemaReady) return
  await ctx.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS api_rate_limits (
      bucket_key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run()
  await ctx.env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires_at ON api_rate_limits (expires_at)',
  ).run()
  schemaReady = true
}

function hasD1Binding(ctx: RequestContext): boolean {
  const db = ctx.env.DB as unknown
  return Boolean(db && typeof db === 'object' && typeof (db as { prepare?: unknown }).prepare === 'function')
}
