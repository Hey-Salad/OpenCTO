// Authentication handlers for OpenCTO API
// Implements session, device management, and passkey enrollment

import type {
  AuthSession,
  TrustedDevice,
  PasskeyCredential,
  PasskeyEnrollmentStart,
  PasskeyEnrollmentComplete,
  RequestContext,
} from './types'
import { NotFoundException, BadRequestException } from './errors'
import { jsonResponse } from './errors'

// GET /api/v1/auth/session
export async function getSession(ctx: RequestContext): Promise<Response> {
  const { user, env } = ctx

  // Query trusted devices for this user
  const deviceResult = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM devices WHERE user_id = ? AND trust_state = ?'
  )
    .bind(user.id, 'TRUSTED')
    .first<{ count: number }>()

  const session: AuthSession = {
    isAuthenticated: true,
    trustedDevice: (deviceResult?.count || 0) > 0,
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

  const result = await env.DB.prepare(
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

  const result = await env.DB.prepare(
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

// Helper function to generate a cryptographic challenge
function generateChallenge(): string {
  const buffer = new Uint8Array(32)
  crypto.getRandomValues(buffer)
  return btoa(String.fromCharCode(...buffer))
}
