import { BadRequestException, jsonResponse } from './errors'
import { enforceRateLimit } from './rateLimit'
import type { RequestContext } from './types'

const DEFAULT_ALLOWED_MODELS = [
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.5-flash-native-audio-preview-09-2025',
] as const
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 5
const DEFAULT_SESSIONS_PER_MINUTE = 12

interface GoogleLiveSessionTokenPayload {
  iss: 'opencto-api-worker'
  aud: 'opencto-google-live'
  sub: string
  email: string
  workspaceId: string
  model: string
  traceId: string
  sessionId: string
  iat: number
  exp: number
}

interface BootstrapRequestBody {
  workspaceId?: string
  model?: string
}

export async function mintGoogleLiveSession(_request: Request, ctx: RequestContext): Promise<Response> {
  if (!ctx.env.GOOGLE_LIVE_BACKEND_URL) {
    return jsonResponse(
      { error: 'GOOGLE_LIVE_BACKEND_URL is not configured', code: 'CONFIG_ERROR' },
      500,
    )
  }

  if (!ctx.env.GOOGLE_LIVE_SHARED_SECRET) {
    return jsonResponse(
      { error: 'GOOGLE_LIVE_SHARED_SECRET is not configured', code: 'CONFIG_ERROR' },
      500,
    )
  }

  const body = await _request.clone().json().catch(() => ({})) as BootstrapRequestBody
  const workspaceId = sanitizeWorkspaceId(body.workspaceId ?? 'default')
  await enforceRateLimit(ctx, 'google_live_session', {
    limit: parsePositiveInt(ctx.env.RATE_LIMIT_GOOGLE_LIVE_SESSIONS_PER_MINUTE, DEFAULT_SESSIONS_PER_MINUTE),
    windowSeconds: 60,
    workspaceId,
  })
  const selectedModel = selectAllowedGoogleLiveModel(
    body.model,
    ctx.env.GOOGLE_LIVE_DEFAULT_MODEL,
    ctx.env.GOOGLE_LIVE_ALLOWED_MODELS,
  )

  const now = Math.floor(Date.now() / 1000)
  const ttlSeconds = parsePositiveInt(ctx.env.GOOGLE_LIVE_SESSION_TTL_SECONDS, DEFAULT_TOKEN_TTL_SECONDS)
  const sessionId = ctx.traceContext.sessionId ?? crypto.randomUUID()
  const payload: GoogleLiveSessionTokenPayload = {
    iss: 'opencto-api-worker',
    aud: 'opencto-google-live',
    sub: ctx.userId,
    email: ctx.user.email,
    workspaceId,
    model: selectedModel,
    traceId: ctx.traceContext.traceId,
    sessionId,
    iat: now,
    exp: now + ttlSeconds,
  }

  const sessionToken = await signGoogleLiveSessionToken(payload, ctx.env.GOOGLE_LIVE_SHARED_SECRET)
  const wsUrl = buildGoogleLiveWebSocketUrl(ctx.env.GOOGLE_LIVE_BACKEND_URL)

  return jsonResponse({
    provider: 'google_vertex',
    mode: 'vertex_live',
    model: selectedModel,
    wsUrl,
    websocketUrl: wsUrl,
    sessionToken,
    workspaceId,
    sessionId,
    traceId: ctx.traceContext.traceId,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  })
}

export async function createGoogleLiveSession(request: Request, ctx: RequestContext): Promise<Response> {
  return mintGoogleLiveSession(request, ctx)
}

export function selectAllowedGoogleLiveModel(
  requestedModel: string | null | undefined,
  defaultModelRaw?: string,
  allowedModelsRaw?: string,
): string {
  const allowedModels = parseAllowedModels(allowedModelsRaw)
  const fallbackModel = allowedModels[0] ?? DEFAULT_ALLOWED_MODELS[0]
  const defaultModel = normalizeGoogleModel(defaultModelRaw) ?? fallbackModel
  const requested = normalizeGoogleModel(requestedModel)
  if (requested && allowedModels.includes(requested)) return requested
  return allowedModels.includes(defaultModel) ? defaultModel : fallbackModel
}

export async function signGoogleLiveSessionToken(
  payload: GoogleLiveSessionTokenPayload,
  secret: string,
): Promise<string> {
  const header = base64UrlEncodeJson({ alg: 'HS256', typ: 'JWT' })
  const body = base64UrlEncodeJson(payload)
  const unsigned = `${header}.${body}`
  const signature = await signHmacSha256(unsigned, secret)
  return `${unsigned}.${signature}`
}

export function buildGoogleLiveWebSocketUrl(baseUrlRaw: string): string {
  const url = new URL(baseUrlRaw)
  if (url.protocol === 'https:') url.protocol = 'wss:'
  if (url.protocol === 'http:') url.protocol = 'ws:'
  url.search = ''
  url.hash = ''
  url.pathname = joinUrlPath(url.pathname, '/ws/live')
  return url.toString()
}

function parseAllowedModels(allowedModelsRaw?: string): string[] {
  const parsed = String(allowedModelsRaw ?? '')
    .split(',')
    .map((value) => normalizeGoogleModel(value))
    .filter((value): value is string => Boolean(value))

  return parsed.length > 0 ? [...new Set(parsed)] : [...DEFAULT_ALLOWED_MODELS]
}

function normalizeGoogleModel(modelRaw: string | null | undefined): string | null {
  const normalized = String(modelRaw ?? '').trim().replace(/^models\//, '')
  if (!normalized) return null
  if (!/^gemini-[a-z0-9.-]+$/i.test(normalized)) return null
  return normalized
}

function sanitizeWorkspaceId(workspaceIdRaw: string): string {
  const workspaceId = String(workspaceIdRaw ?? '').trim()
  if (!workspaceId || !/^[a-zA-Z0-9._-]{1,80}$/.test(workspaceId)) {
    throw new BadRequestException('workspaceId must match /^[a-zA-Z0-9._-]{1,80}$/')
  }
  return workspaceId
}

function joinUrlPath(existingPath: string, suffix: string): string {
  const base = existingPath.replace(/\/+$/, '')
  if (base.endsWith(suffix)) return base || suffix
  return `${base}${suffix}`
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

async function signHmacSha256(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return base64UrlEncodeBytes(new Uint8Array(signature))
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)))
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
