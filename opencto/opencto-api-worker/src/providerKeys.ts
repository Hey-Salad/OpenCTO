import type { RequestContext } from './types'
import { BadRequestException, ForbiddenException, InternalServerException, NotFoundException, jsonResponse } from './errors'
import { redactSecrets } from './redaction'

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

let schemaReady = false

export async function listProviderKeys(request: Request, ctx: RequestContext): Promise<Response> {
  await ensureSchema(ctx)
  const url = new URL(request.url)
  const workspaceId = sanitizeWorkspaceId(url.searchParams.get('workspaceId') ?? 'default')
  await ensureWorkspaceAccess(workspaceId, ctx)

  const { results } = await ctx.env.DB.prepare(
    `SELECT id, user_id, workspace_id, provider, key_hint, encrypted_key_b64, iv_b64, created_at, updated_at
     FROM user_provider_keys
     WHERE user_id = ? AND workspace_id = ?
     ORDER BY provider ASC`,
  ).bind(ctx.userId, workspaceId).all<ProviderKeyRow>()

  const keys = (results ?? []).map((row) => ({
    provider: row.provider,
    workspaceId: row.workspace_id,
    keyHint: row.key_hint,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return jsonResponse({ workspaceId, keys })
}

export async function upsertProviderKey(providerRaw: string, request: Request, ctx: RequestContext): Promise<Response> {
  await ensureSchema(ctx)
  const provider = sanitizeProvider(providerRaw)
  const body = await request.json().catch(() => ({})) as { apiKey?: string; workspaceId?: string }
  const apiKey = String(body.apiKey ?? '').trim()
  if (!apiKey || apiKey.length < 8) {
    throw new BadRequestException('apiKey is required and must be at least 8 characters')
  }

  const workspaceId = sanitizeWorkspaceId(body.workspaceId ?? 'default')
  await ensureWorkspaceAccess(workspaceId, ctx)
  const { encryptedB64, ivB64 } = await encryptForUser(apiKey, ctx.userId, ctx.env.JWT_SECRET)
  const now = new Date().toISOString()
  const id = `${ctx.userId}:${workspaceId}:${provider}`
  const keyHint = buildKeyHint(apiKey)

  await ctx.env.DB.prepare(
    `INSERT INTO user_provider_keys (id, user_id, workspace_id, provider, key_hint, encrypted_key_b64, iv_b64, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       key_hint = excluded.key_hint,
       encrypted_key_b64 = excluded.encrypted_key_b64,
       iv_b64 = excluded.iv_b64,
       updated_at = excluded.updated_at`,
  ).bind(id, ctx.userId, workspaceId, provider, keyHint, encryptedB64, ivB64, now, now).run()

  return jsonResponse({
    saved: true,
    provider,
    workspaceId,
    keyHint,
    updatedAt: now,
  })
}

export async function deleteProviderKey(providerRaw: string, request: Request, ctx: RequestContext): Promise<Response> {
  await ensureSchema(ctx)
  const provider = sanitizeProvider(providerRaw)
  const workspaceId = sanitizeWorkspaceId(new URL(request.url).searchParams.get('workspaceId') ?? 'default')
  await ensureWorkspaceAccess(workspaceId, ctx)
  const id = `${ctx.userId}:${workspaceId}:${provider}`

  const result = await ctx.env.DB.prepare(
    'DELETE FROM user_provider_keys WHERE id = ?',
  ).bind(id).run()

  return jsonResponse({
    deleted: (result.meta?.changes ?? 0) > 0,
    provider,
    workspaceId,
  })
}

export async function resolveProviderApiKey(
  providerRaw: string,
  workspaceIdRaw: string | null | undefined,
  ctx: RequestContext,
  fallbackKey?: string,
): Promise<string> {
  const provider = sanitizeProvider(providerRaw)
  const workspaceId = sanitizeWorkspaceId(workspaceIdRaw ?? 'default')
  await ensureWorkspaceAccess(workspaceId, ctx)
  if (!hasD1Binding(ctx)) {
    if (fallbackKey) return fallbackKey
    throw new InternalServerException(`No API key configured for provider ${provider}`)
  }

  await ensureSchema(ctx)
  const id = `${ctx.userId}:${workspaceId}:${provider}`
  const row = await ctx.env.DB.prepare(
    `SELECT encrypted_key_b64, iv_b64 FROM user_provider_keys WHERE id = ?`,
  ).bind(id).first<{ encrypted_key_b64: string; iv_b64: string }>()

  if (!row) {
    if (fallbackKey) return fallbackKey
    throw new NotFoundException(`No API key found for provider ${provider} in workspace ${workspaceId}`)
  }

  try {
    return await decryptForUser(row.encrypted_key_b64, row.iv_b64, ctx.userId, ctx.env.JWT_SECRET)
  } catch (error) {
    throw new InternalServerException('Stored provider key could not be decrypted', {
      provider,
      workspaceId,
      reason: redactSecrets(String(error)),
    })
  }
}

async function ensureSchema(ctx: RequestContext): Promise<void> {
  if (!hasD1Binding(ctx)) {
    throw new InternalServerException('D1 database binding is not configured for provider keys')
  }
  if (schemaReady) return

  await ctx.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS user_provider_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      key_hint TEXT NOT NULL,
      encrypted_key_b64 TEXT NOT NULL,
      iv_b64 TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run()

  await ctx.env.DB.prepare(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_provider_keys_scope ON user_provider_keys (user_id, workspace_id, provider)',
  ).run()

  schemaReady = true
}

function hasD1Binding(ctx: RequestContext): boolean {
  const db = ctx.env.DB as unknown
  return Boolean(db && typeof db === 'object' && typeof (db as { prepare?: unknown }).prepare === 'function')
}

async function ensureWorkspaceAccess(workspaceId: string, ctx: RequestContext): Promise<void> {
  if (!hasD1Binding(ctx)) return
  if (workspaceId === 'default') return

  // Enforce membership/ownership when onboarding workspace tables are available.
  try {
    const membership = await ctx.env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM workspace_members
       WHERE workspace_id = ? AND user_id = ?`,
    ).bind(workspaceId, ctx.userId).first<{ count: number }>()

    if ((membership?.count ?? 0) > 0) return

    const ownership = await ctx.env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM workspaces
       WHERE id = ? AND owner_user_id = ?`,
    ).bind(workspaceId, ctx.userId).first<{ count: number }>()

    if ((ownership?.count ?? 0) > 0) return

    const profile = await ctx.env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM user_profiles
       WHERE user_id = ? AND workspace_id = ?`,
    ).bind(ctx.userId, workspaceId).first<{ count: number }>()

    if ((profile?.count ?? 0) > 0) return

    throw new ForbiddenException('Workspace access denied', { workspaceId })
  } catch (error) {
    if (error instanceof ForbiddenException) throw error
    // Legacy/self-hosted installs may not have onboarding tables yet.
    return
  }
}

function sanitizeProvider(providerRaw: string): string {
  const provider = String(providerRaw ?? '').trim().toLowerCase()
  if (!provider || !/^[a-z0-9_-]{2,40}$/.test(provider)) {
    throw new BadRequestException('provider must match /^[a-z0-9_-]{2,40}$/')
  }
  return provider
}

function sanitizeWorkspaceId(workspaceIdRaw: string): string {
  const workspaceId = String(workspaceIdRaw ?? '').trim()
  if (!workspaceId || !/^[a-zA-Z0-9._-]{1,80}$/.test(workspaceId)) {
    throw new BadRequestException('workspaceId must match /^[a-zA-Z0-9._-]{1,80}$/')
  }
  return workspaceId
}

function buildKeyHint(apiKey: string): string {
  const tail = apiKey.slice(-4)
  return `****${tail}`
}

async function encryptForUser(plaintext: string, userId: string, secret: string): Promise<{ encryptedB64: string; ivB64: string }> {
  const key = await deriveEncryptionKey(userId, secret, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const input = new TextEncoder().encode(plaintext)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    input,
  )
  return {
    encryptedB64: bytesToBase64(new Uint8Array(encrypted)),
    ivB64: bytesToBase64(iv),
  }
}

async function decryptForUser(encryptedB64: string, ivB64: string, userId: string, secret: string): Promise<string> {
  const key = await deriveEncryptionKey(userId, secret, ['decrypt'])
  const ciphertext = base64ToBytes(encryptedB64)
  const iv = base64ToBytes(ivB64)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )
  return new TextDecoder().decode(decrypted)
}

async function deriveEncryptionKey(
  userId: string,
  secret: string,
  keyUsages: Array<'encrypt' | 'decrypt'>,
): Promise<CryptoKey> {
  const material = new TextEncoder().encode(`${secret}:${userId}:provider-key-v1`)
  const digest = await crypto.subtle.digest('SHA-256', material)
  return await crypto.subtle.importKey(
    'raw',
    digest,
    { name: 'AES-GCM' },
    false,
    keyUsages,
  )
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}
