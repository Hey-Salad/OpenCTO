// Authentication handlers for OpenCTO API
// Implements session, device management, and passkey enrollment

import type {
  AuthSession,
  TrustedDevice,
  PasskeyCredential,
  PasskeyEnrollmentStart,
  PasskeyEnrollmentComplete,
  RequestContext,
  Env,
  SessionUser,
} from './types'
import { NotFoundException, BadRequestException } from './errors'
import { jsonResponse } from './errors'
import { upsertGitHubConnection } from './github'

type SessionTokenPayload = {
  sub: string
  email: string
  name: string
  role: SessionUser['role']
  provider: 'github'
  exp: number
}

type OAuthStatePayload = {
  nonce: string
  returnTo: string
  exp: number
}

// GET /api/v1/auth/session
export async function getSession(ctx: RequestContext): Promise<Response> {
  const { user, env } = ctx

  if (!env.DB) {
    const session: AuthSession = {
      isAuthenticated: true,
      trustedDevice: true,
      mfaRequired: false,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    }
    return jsonResponse(session)
  }

  let trustedDevice = true
  try {
    const deviceResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM devices WHERE user_id = ? AND trust_state = ?'
    )
      .bind(user.id, 'TRUSTED')
      .first<{ count: number }>()
    trustedDevice = (deviceResult?.count || 0) > 0
  } catch {
    trustedDevice = true
  }

  const session: AuthSession = {
    isAuthenticated: true,
    trustedDevice,
    mfaRequired: false, // TODO: Implement MFA logic
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  }

  return jsonResponse(session)
}

// GET /api/v1/auth/devices
export async function getTrustedDevices(ctx: RequestContext): Promise<Response> {
  const { user, env } = ctx
  if (!env.DB) return jsonResponse([])

  let result: {
    results?: Array<{
      id: string
      display_name: string
      platform: string
      city: string
      country: string
      last_seen_at: string
      trust_state: string
    }>
  }
  try {
    result = await env.DB.prepare(
      'SELECT id, display_name, platform, city, country, last_seen_at, trust_state FROM devices WHERE user_id = ? ORDER BY last_seen_at DESC'
    )
      .bind(user.id)
      .all<{
        id: string
        display_name: string
        platform: string
        city: string
        country: string
        last_seen_at: string
        trust_state: string
      }>()
  } catch {
    return jsonResponse([])
  }

  const devices: TrustedDevice[] = (result.results || []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    platform: row.platform as TrustedDevice['platform'],
    city: row.city,
    country: row.country,
    lastSeenAt: row.last_seen_at,
    trustState: row.trust_state as TrustedDevice['trustState'],
  }))

  return jsonResponse(devices)
}

// POST /api/v1/auth/devices/:id/revoke
export async function revokeDevice(
  deviceId: string,
  ctx: RequestContext
): Promise<Response> {
  const { user, env } = ctx
  if (!env.DB) {
    throw new NotFoundException('Device not found')
  }

  // Verify device belongs to user
  const device = await env.DB.prepare(
    'SELECT id, display_name, platform, city, country, last_seen_at, trust_state FROM devices WHERE id = ? AND user_id = ?'
  )
    .bind(deviceId, user.id)
    .first<{
      id: string
      display_name: string
      platform: string
      city: string
      country: string
      last_seen_at: string
      trust_state: string
    }>()

  if (!device) {
    throw new NotFoundException('Device not found')
  }

  // Update device trust state to REVOKED
  await env.DB.prepare(
    'UPDATE devices SET trust_state = ? WHERE id = ?'
  )
    .bind('REVOKED', deviceId)
    .run()

  const revokedDevice: TrustedDevice = {
    id: device.id,
    displayName: device.display_name,
    platform: device.platform as TrustedDevice['platform'],
    city: device.city,
    country: device.country,
    lastSeenAt: device.last_seen_at,
    trustState: 'REVOKED',
  }

  return jsonResponse(revokedDevice)
}

// GET /api/v1/auth/passkeys (not in original spec but useful)
export async function listPasskeys(ctx: RequestContext): Promise<Response> {
  const { user, env } = ctx
  if (!env.DB) return jsonResponse([])

  let result: {
    results?: Array<{
      id: string
      display_name: string
      device_type: string
      last_used_at: string | null
      created_at: string
    }>
  }
  try {
    result = await env.DB.prepare(
      'SELECT id, display_name, device_type, last_used_at, created_at FROM passkey_credentials WHERE user_id = ? ORDER BY created_at DESC'
    )
      .bind(user.id)
      .all<{
        id: string
        display_name: string
        device_type: string
        last_used_at: string | null
        created_at: string
      }>()
  } catch {
    return jsonResponse([])
  }

  const passkeys: PasskeyCredential[] = (result.results || []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    deviceType: row.device_type as PasskeyCredential['deviceType'],
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  }))

  return jsonResponse(passkeys)
}

// POST /api/v1/auth/passkeys/enroll/start
export async function startPasskeyEnrollment(ctx: RequestContext): Promise<Response> {
  const { user, env } = ctx
  if (!env.DB) {
    return jsonResponse({
      challenge: generateChallenge(),
      rpId: env.WEBAUTHN_RP_ID,
      userId: user.id,
    })
  }

  // Generate a random challenge
  const challenge = generateChallenge()
  const challengeId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes

  // Store challenge in database
  await env.DB.prepare(
    'INSERT INTO passkey_challenges (id, user_id, challenge, expires_at) VALUES (?, ?, ?, ?)'
  )
    .bind(challengeId, user.id, challenge, expiresAt)
    .run()

  const enrollment: PasskeyEnrollmentStart = {
    challenge,
    rpId: env.WEBAUTHN_RP_ID,
    userId: user.id,
  }

  return jsonResponse(enrollment)
}

// POST /api/v1/auth/passkeys/enroll/complete
export async function completePasskeyEnrollment(
  challengeResponse: string,
  ctx: RequestContext
): Promise<Response> {
  const { user, env } = ctx
  if (!env.DB) {
    if (!challengeResponse.length) {
      throw new BadRequestException('Invalid challenge response')
    }
    return jsonResponse({
      passkeyId: crypto.randomUUID(),
      verified: true,
    })
  }

  // In a real implementation, you would:
  // 1. Verify the challenge response using @simplewebauthn/server
  // 2. Extract the credential ID and public key
  // 3. Store the credential in the database
  // 4. Delete the used challenge

  // For now, we'll create a stub implementation
  const passkeyId = crypto.randomUUID()

  // TODO: Implement actual WebAuthn verification
  // This is a placeholder that always succeeds
  const verified = challengeResponse.length > 0

  if (!verified) {
    throw new BadRequestException('Invalid challenge response')
  }

  // Store the passkey credential (stub data for now)
  await env.DB.prepare(
    'INSERT INTO passkey_credentials (id, user_id, display_name, device_type, credential_id, public_key, counter) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(
      passkeyId,
      user.id,
      'New Passkey',
      'platform',
      'stub-credential-id',
      'stub-public-key',
      0
    )
    .run()

  const result: PasskeyEnrollmentComplete = {
    passkeyId,
    verified,
  }

  return jsonResponse(result)
}

export async function startGitHubOAuth(request: Request, env: Env): Promise<Response> {
  if (!env.JWT_SECRET) {
    return jsonResponse({ error: 'JWT_SECRET is not configured', code: 'CONFIG_ERROR', status: 500 }, 500)
  }
  if (!env.GITHUB_OAUTH_CLIENT_ID) {
    return jsonResponse({ error: 'GITHUB_OAUTH_CLIENT_ID is not configured', code: 'CONFIG_ERROR', status: 500 }, 500)
  }

  const url = new URL(request.url)
  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'), env.APP_BASE_URL || 'https://app.opencto.works')
  const redirectUri = `${resolveApiBaseUrl(request, env)}/api/v1/auth/oauth/github/callback`
  const state = await signToken<OAuthStatePayload>(
    {
      nonce: crypto.randomUUID(),
      returnTo,
      exp: nowEpochSeconds() + 600,
    },
    env.JWT_SECRET,
  )

  const github = new URL('https://github.com/login/oauth/authorize')
  github.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID)
  github.searchParams.set('redirect_uri', redirectUri)
  github.searchParams.set('scope', 'read:user user:email read:org repo')
  github.searchParams.set('state', state)

  return Response.redirect(github.toString(), 302)
}

export async function completeGitHubOAuth(request: Request, env: Env): Promise<Response> {
  if (!env.JWT_SECRET) {
    return jsonResponse({ error: 'JWT_SECRET is not configured', code: 'CONFIG_ERROR', status: 500 }, 500)
  }
  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
    return jsonResponse(
      { error: 'GITHUB_OAUTH_CLIENT_ID or GITHUB_OAUTH_CLIENT_SECRET is not configured', code: 'CONFIG_ERROR', status: 500 },
      500,
    )
  }

  const url = new URL(request.url)
  const oauthError = (url.searchParams.get('error') ?? '').trim()
  if (oauthError) {
    return jsonResponse(
      {
        error: 'GitHub OAuth flow was denied or canceled',
        code: 'OAUTH_DENIED',
        status: 401,
        details: {
          providerError: oauthError,
          providerErrorDescription: url.searchParams.get('error_description') ?? undefined,
        },
      },
      401,
    )
  }

  const code = url.searchParams.get('code') ?? ''
  const stateToken = url.searchParams.get('state') ?? ''
  if (!code || !stateToken) {
    return jsonResponse({ error: 'Missing code/state from GitHub OAuth callback', code: 'BAD_REQUEST', status: 400 }, 400)
  }

  const state = await verifyToken<OAuthStatePayload>(stateToken, env.JWT_SECRET)
  if (!state || state.exp < nowEpochSeconds()) {
    return jsonResponse({ error: 'Invalid or expired OAuth state', code: 'UNAUTHORIZED', status: 401 }, 401)
  }

  const redirectUri = `${resolveApiBaseUrl(request, env)}/api/v1/auth/oauth/github/callback`
  let tokenRes: Response
  try {
    tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        state: stateToken,
      }),
    })
  } catch (err) {
    return jsonResponse(
      {
        error: 'GitHub token exchange request failed',
        code: 'UPSTREAM_ERROR',
        status: 502,
        details: { provider: 'github', stage: 'oauth_token_exchange', reason: String(err) },
      },
      502,
    )
  }

  const tokenBody = await tokenRes.json().catch(() => ({})) as { access_token?: string; scope?: string; error?: string }
  const githubAccessToken = tokenBody.access_token
  if (!tokenRes.ok || !githubAccessToken) {
    return jsonResponse(
      {
        error: 'Failed to exchange GitHub OAuth code',
        code: 'UPSTREAM_ERROR',
        status: 502,
        details: {
          provider: 'github',
          stage: 'oauth_token_exchange',
          upstreamStatus: tokenRes.status,
          upstreamError: tokenBody.error ?? 'missing_access_token',
        },
      },
      502,
    )
  }

  let userRes: Response
  try {
    userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${githubAccessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'opencto-api-worker',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  } catch (err) {
    return jsonResponse(
      {
        error: 'GitHub user profile request failed',
        code: 'UPSTREAM_ERROR',
        status: 502,
        details: { provider: 'github', stage: 'load_profile', reason: String(err) },
      },
      502,
    )
  }
  const userBody = await userRes.json().catch(() => ({})) as { id?: number; login?: string; name?: string; email?: string | null }
  if (!userRes.ok || !userBody.id || !userBody.login) {
    return jsonResponse(
      {
        error: 'Failed to load GitHub user profile',
        code: 'UPSTREAM_ERROR',
        status: 502,
        details: {
          provider: 'github',
          stage: 'load_profile',
          upstreamStatus: userRes.status,
          hasId: Boolean(userBody.id),
          hasLogin: Boolean(userBody.login),
        },
      },
      502,
    )
  }

  let email = userBody.email ?? ''
  if (!email) {
    let emailsRes: Response
    try {
      emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'opencto-api-worker',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
    } catch (err) {
      return jsonResponse(
        {
          error: 'GitHub email lookup request failed',
          code: 'UPSTREAM_ERROR',
          status: 502,
          details: { provider: 'github', stage: 'load_emails', reason: String(err) },
        },
        502,
      )
    }
    const emailsBody = await emailsRes.json().catch(() => []) as Array<{ email?: string; primary?: boolean; verified?: boolean }>
    const primary = emailsBody.find((e) => e.primary && e.verified)?.email
      ?? emailsBody.find((e) => e.verified)?.email
      ?? emailsBody[0]?.email
      ?? ''
    email = primary
  }

  if (!email) {
    return jsonResponse({ error: 'GitHub account does not expose an email', code: 'UNAUTHORIZED', status: 401 }, 401)
  }

  if (env.DB) {
    await upsertGitHubConnection(env, {
      userId: `github-${userBody.id}`,
      githubUserId: String(userBody.id),
      githubLogin: userBody.login,
      accessToken: githubAccessToken,
      scope: tokenBody.scope ?? '',
    })
  }

  const sessionToken = await signToken<SessionTokenPayload>(
    {
      sub: `github-${userBody.id}`,
      email,
      name: userBody.name || userBody.login,
      role: 'owner',
      provider: 'github',
      exp: nowEpochSeconds() + 60 * 60 * 24 * 7,
    },
    env.JWT_SECRET,
  )

  const returnTo = sanitizeReturnTo(state.returnTo, env.APP_BASE_URL || 'https://app.opencto.works')
  const location = `${returnTo}#auth_token=${encodeURIComponent(sessionToken)}`
  return Response.redirect(location, 302)
}

export async function parseSessionToken(token: string, env: Env): Promise<SessionUser | null> {
  if (!env.JWT_SECRET) return null
  const payload = await verifyToken<SessionTokenPayload>(token, env.JWT_SECRET)
  if (!isValidSessionTokenPayload(payload) || payload.exp < nowEpochSeconds()) return null
  return {
    id: payload.sub,
    email: payload.email,
    displayName: payload.name,
    role: payload.role,
  }
}

// DELETE /api/v1/auth/account
export async function deleteAccount(ctx: RequestContext): Promise<Response> {
  const { env, userId } = ctx
  if (!env.DB) {
    return jsonResponse({ deleted: false, reason: 'D1 database not configured' }, 200)
  }

  const deleteStatements: Array<{ sql: string; args: unknown[] }> = [
    { sql: 'DELETE FROM devices WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM passkey_credentials WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM passkey_challenges WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM chats WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM github_connections WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM github_orgs WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM github_repositories WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM github_pull_requests WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM github_check_runs WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM onboarding_meta WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM user_profiles WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM workspace_members WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM subscriptions WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM usage_metrics WHERE user_id = ?', args: [userId] },
  ]

  for (const statement of deleteStatements) {
    try {
      await env.DB.prepare(statement.sql).bind(...statement.args).run()
    } catch {
      // Ignore missing table/schema drift and continue.
    }
  }

  return jsonResponse({ deleted: true })
}

function sanitizeReturnTo(raw: string | null, fallback: string): string {
  const safeFallback = safeAppBaseUrl(fallback)
  if (!raw) return safeFallback
  try {
    const url = new URL(raw)
    if (isAllowedMobileReturnTo(url)) {
      return `${url.protocol}//${url.hostname}${url.pathname}${url.search}`
    }

    const fallbackUrl = new URL(safeFallback)
    if (url.protocol !== 'https:') return safeFallback
    const isSameHost = url.hostname === fallbackUrl.hostname
    const isSubdomain = url.hostname.endsWith(`.${fallbackUrl.hostname}`)
    if (!isSameHost && !isSubdomain) return safeFallback
    return `${url.origin}${url.pathname}${url.search}`
  } catch {
    return safeFallback
  }
}

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function resolveApiBaseUrl(request: Request, env: Env): string {
  const configured = (env.API_BASE_URL || '').trim()
  if (configured) return configured.replace(/\/+$/, '')
  return new URL(request.url).origin
}

function base64UrlEncode(input: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...input))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function signToken<T extends Record<string, unknown>>(payload: T, secret: string): Promise<string> {
  const key = await importHmacKey(secret)
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload))
  const payloadB64 = base64UrlEncode(payloadBytes)
  const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64)))
  return `${payloadB64}.${base64UrlEncode(sigBytes)}`
}

async function verifyToken<T extends Record<string, unknown>>(token: string, secret: string): Promise<T | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts
  if (!payloadB64 || !sigB64) return null
  try {
    const key = await importHmacKey(secret)
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(sigB64),
      new TextEncoder().encode(payloadB64),
    )
    if (!ok) return null
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as T
  } catch {
    return null
  }
}

function isValidSessionTokenPayload(payload: SessionTokenPayload | null): payload is SessionTokenPayload {
  return Boolean(
    payload
      && typeof payload.sub === 'string'
      && typeof payload.email === 'string'
      && payload.email.includes('@')
      && typeof payload.name === 'string'
      && typeof payload.role === 'string'
      && payload.provider === 'github'
      && typeof payload.exp === 'number',
  )
}

function safeAppBaseUrl(raw: string): string {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return 'https://app.opencto.works'
    return url.origin
  } catch {
    return 'https://app.opencto.works'
  }
}

function isAllowedMobileReturnTo(url: URL): boolean {
  if (url.protocol !== 'opencto:') return false
  if (url.hostname !== 'auth') return false
  return url.pathname === '/callback'
}

// Helper function to generate a cryptographic challenge
function generateChallenge(): string {
  const buffer = new Uint8Array(32)
  crypto.getRandomValues(buffer)
  return btoa(String.fromCharCode(...buffer))
}
