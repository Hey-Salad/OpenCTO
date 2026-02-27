import type { ReactNode } from 'react'
import type { AuthSession } from '../../types/auth'

interface RouteGuardProps {
  session: AuthSession | null
  isLoading: boolean
  fallback?: ReactNode
  children: ReactNode
}

export function RouteGuard({ session, isLoading, fallback, children }: RouteGuardProps) {
  if (isLoading) {
    return <p className="muted">Loading session...</p>
  }

  if (!session?.isAuthenticated) {
    return <>{fallback ?? <p className="muted">Authentication required.</p>}</>
  }

  return <>{children}</>
}
