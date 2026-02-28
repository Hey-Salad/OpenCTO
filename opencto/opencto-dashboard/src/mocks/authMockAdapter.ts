import type { AuthApi } from '../api/authClient'
import type {
  AuthSession,
  OAuthProvider,
  PasskeyCredential,
  PasskeyEnrollmentComplete,
  PasskeyEnrollmentStart,
  TrustedDevice,
} from '../types/auth'
import { isSuperAdminEmail, resolveRoleForEmail } from '../lib/authPolicy'

let session: AuthSession = {
  isAuthenticated: true,
  trustedDevice: true,
  mfaRequired: false,
  user: {
    id: 'usr-1',
    email: 'peter@heysalad.io',
    displayName: 'OpenCTO Admin',
    role: 'owner',
    isSuperAdmin: true,
    authProvider: 'google',
  },
}

const devices: TrustedDevice[] = [
  {
    id: 'dev-1',
    displayName: 'MacBook Pro CTO',
    platform: 'macos',
    city: 'San Francisco',
    country: 'US',
    lastSeenAt: new Date().toISOString(),
    trustState: 'TRUSTED',
  },
  {
    id: 'dev-2',
    displayName: 'Raspberry Pi Clawbot',
    platform: 'linux',
    city: 'San Francisco',
    country: 'US',
    lastSeenAt: new Date(Date.now() - 86400000).toISOString(),
    trustState: 'NEW',
  },
]

const passkeys: PasskeyCredential[] = [
  {
    id: 'pk-1',
    displayName: 'Mac Touch ID',
    deviceType: 'platform',
    lastUsedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 1209600000).toISOString(),
  },
]

export class AuthMockAdapter implements AuthApi {
  async getSession(): Promise<AuthSession> {
    return structuredClone(session)
  }

  async signInWithProvider(provider: OAuthProvider): Promise<AuthSession> {
    const emailByProvider: Record<OAuthProvider, string> = {
      google: 'peter@heysalad.io',
      github: 'dev@heysalad.io',
      cloudflare: 'ops@heysalad.io',
    }

    const email = emailByProvider[provider]

    session = {
      ...session,
      isAuthenticated: true,
      user: {
        id: `usr-${provider}`,
        email,
        displayName: `${provider.toUpperCase()} User`,
        role: resolveRoleForEmail(email),
        isSuperAdmin: isSuperAdminEmail(email),
        authProvider: provider,
      },
    }

    return structuredClone(session)
  }

  async getTrustedDevices(): Promise<TrustedDevice[]> {
    return structuredClone(devices)
  }

  async revokeDevice(deviceId: string): Promise<TrustedDevice> {
    const target = devices.find((item) => item.id === deviceId)
    if (!target) {
      throw new Error('Device not found')
    }
    target.trustState = 'REVOKED'
    return structuredClone(target)
  }

  async listPasskeys(): Promise<PasskeyCredential[]> {
    return structuredClone(passkeys)
  }

  async startPasskeyEnrollment(): Promise<PasskeyEnrollmentStart> {
    return {
      challenge: 'mock-challenge',
      rpId: 'opencto.works',
      userId: session.user?.id ?? 'unknown',
    }
  }

  async completePasskeyEnrollment(challengeResponse: string): Promise<PasskeyEnrollmentComplete> {
    void challengeResponse
    return {
      passkeyId: `pk-${Date.now()}`,
      verified: true,
    }
  }
}
