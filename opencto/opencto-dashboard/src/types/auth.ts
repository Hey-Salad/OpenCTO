export type UserRole = 'owner' | 'cto' | 'developer' | 'viewer' | 'auditor'
export type OAuthProvider = 'google' | 'github' | 'cloudflare'

export interface SessionUser {
  id: string
  email: string
  displayName: string
  role: UserRole
  isSuperAdmin: boolean
  authProvider?: OAuthProvider
}

export interface AuthSession {
  isAuthenticated: boolean
  trustedDevice: boolean
  mfaRequired: boolean
  user: SessionUser | null
}

export type DeviceTrustState = 'TRUSTED' | 'NEW' | 'REVOKED'

export interface TrustedDevice {
  id: string
  displayName: string
  platform: 'macos' | 'ios' | 'linux' | 'windows'
  city: string
  country: string
  lastSeenAt: string
  trustState: DeviceTrustState
}

export interface PasskeyCredential {
  id: string
  displayName: string
  deviceType: 'platform' | 'cross-platform'
  lastUsedAt: string | null
  createdAt: string
}

export interface PasskeyEnrollmentStart {
  challenge: string
  rpId: string
  userId: string
}

export interface PasskeyEnrollmentComplete {
  passkeyId: string
  verified: boolean
}
