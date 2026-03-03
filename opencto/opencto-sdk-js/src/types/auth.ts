export type UserRole = 'owner' | 'cto' | 'developer' | 'viewer' | 'auditor'

export interface SessionUser {
  id: string
  email: string
  displayName: string
  role: UserRole
}

export interface AuthSession {
  isAuthenticated: boolean
  trustedDevice: boolean
  mfaRequired: boolean
  user: SessionUser | null
}
