import type { ReactNode } from 'react'
import type { UserRole } from '../../types/auth'

interface RoleGuardProps {
  role: UserRole | null
  allowedRoles: UserRole[]
  fallback?: ReactNode
  children: ReactNode
}

export function RoleGuard({ role, allowedRoles, fallback, children }: RoleGuardProps) {
  if (!role || !allowedRoles.includes(role)) {
    return <>{fallback ?? <p className="muted">Insufficient role for this section.</p>}</>
  }

  return <>{children}</>
}
