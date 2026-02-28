import { render, screen } from '@testing-library/react'
import { RouteGuard } from './RouteGuard'
import { RoleGuard } from './RoleGuard'
import type { AuthSession } from '../../types/auth'

const session: AuthSession = {
  isAuthenticated: true,
  trustedDevice: true,
  mfaRequired: false,
  user: {
    id: 'usr-1',
    email: 'user@example.com',
    displayName: 'User',
    role: 'developer',
    isSuperAdmin: false,
    authProvider: 'github',
  },
}

test('route guard renders fallback when session is not authenticated', () => {
  render(
    <RouteGuard session={null} isLoading={false} fallback={<p>Denied</p>}>
      <p>Allowed</p>
    </RouteGuard>,
  )

  expect(screen.getByText('Denied')).toBeInTheDocument()
})

test('route guard renders children when session is authenticated', () => {
  render(
    <RouteGuard session={session} isLoading={false}>
      <p>Allowed</p>
    </RouteGuard>,
  )

  expect(screen.getByText('Allowed')).toBeInTheDocument()
})

test('role guard blocks disallowed role', () => {
  render(
    <RoleGuard role="viewer" allowedRoles={['owner', 'cto']} fallback={<p>Forbidden</p>}>
      <p>Secure</p>
    </RoleGuard>,
  )

  expect(screen.getByText('Forbidden')).toBeInTheDocument()
})
