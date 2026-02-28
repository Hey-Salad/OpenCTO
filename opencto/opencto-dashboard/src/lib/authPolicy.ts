import type { UserRole } from '../types/auth'

export const SUPER_ADMIN_DOMAIN = 'heysalad.io'

export function isSuperAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  return normalized.endsWith(`@${SUPER_ADMIN_DOMAIN}`)
}

export function resolveRoleForEmail(email: string): UserRole {
  return isSuperAdminEmail(email) ? 'owner' : 'developer'
}
