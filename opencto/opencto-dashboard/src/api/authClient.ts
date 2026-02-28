import { normalizeApiError, safeFetchJson } from '../lib/safeError'
import type {
  AuthSession,
  OAuthProvider,
  PasskeyCredential,
  PasskeyEnrollmentComplete,
  PasskeyEnrollmentStart,
  TrustedDevice,
} from '../types/auth'

export interface AuthApi {
  getSession: () => Promise<AuthSession>
  signInWithProvider: (provider: OAuthProvider) => Promise<AuthSession>
  getTrustedDevices: () => Promise<TrustedDevice[]>
  revokeDevice: (deviceId: string) => Promise<TrustedDevice>
  listPasskeys: () => Promise<PasskeyCredential[]>
  startPasskeyEnrollment: () => Promise<PasskeyEnrollmentStart>
  completePasskeyEnrollment: (challengeResponse: string) => Promise<PasskeyEnrollmentComplete>
}

export class AuthHttpClient implements AuthApi {
  constructor(private readonly baseUrl = 'https://api.opencto.works/api/v1') {}

  async getSession(): Promise<AuthSession> {
    try {
      return await safeFetchJson<AuthSession>(`${this.baseUrl}/auth/session`, undefined, 'Failed to load auth session')
    } catch (error) {
      throw normalizeApiError(error, 'Failed to load auth session')
    }
  }

  async signInWithProvider(provider: OAuthProvider): Promise<AuthSession> {
    try {
      return await safeFetchJson<AuthSession>(
        `${this.baseUrl}/auth/oauth/${provider}/start`,
        {
          method: 'POST',
          headers: {
            'x-idempotency-key': `oauth-start-${provider}-${Date.now()}`,
          },
        },
        'Failed to start provider sign-in',
      )
    } catch (error) {
      throw normalizeApiError(error, 'Failed to start provider sign-in')
    }
  }

  async getTrustedDevices(): Promise<TrustedDevice[]> {
    try {
      return await safeFetchJson<TrustedDevice[]>(
        `${this.baseUrl}/auth/devices`,
        undefined,
        'Failed to load trusted devices',
      )
    } catch (error) {
      throw normalizeApiError(error, 'Failed to load trusted devices')
    }
  }

  async revokeDevice(deviceId: string): Promise<TrustedDevice> {
    try {
      return await safeFetchJson<TrustedDevice>(
        `${this.baseUrl}/auth/devices/${deviceId}/revoke`,
        {
          method: 'POST',
          headers: {
            'x-idempotency-key': `revoke-${deviceId}-${Date.now()}`,
          },
        },
        'Failed to revoke device',
      )
    } catch (error) {
      throw normalizeApiError(error, 'Failed to revoke device')
    }
  }

  async listPasskeys(): Promise<PasskeyCredential[]> {
    try {
      return await safeFetchJson<PasskeyCredential[]>(
        `${this.baseUrl}/auth/passkeys`,
        undefined,
        'Failed to load passkeys',
      )
    } catch (error) {
      throw normalizeApiError(error, 'Failed to load passkeys')
    }
  }

  async startPasskeyEnrollment(): Promise<PasskeyEnrollmentStart> {
    try {
      return await safeFetchJson<PasskeyEnrollmentStart>(
        `${this.baseUrl}/auth/passkeys/enroll/start`,
        {
          method: 'POST',
          headers: {
            'x-idempotency-key': `passkey-start-${Date.now()}`,
          },
        },
        'Failed to start passkey enrollment',
      )
    } catch (error) {
      throw normalizeApiError(error, 'Failed to start passkey enrollment')
    }
  }

  async completePasskeyEnrollment(challengeResponse: string): Promise<PasskeyEnrollmentComplete> {
    try {
      return await safeFetchJson<PasskeyEnrollmentComplete>(
        `${this.baseUrl}/auth/passkeys/enroll/complete`,
        {
          method: 'POST',
          body: JSON.stringify({ challengeResponse }),
          headers: {
            'x-idempotency-key': `passkey-complete-${Date.now()}`,
          },
        },
        'Failed to complete passkey enrollment',
      )
    } catch (error) {
      throw normalizeApiError(error, 'Failed to complete passkey enrollment')
    }
  }
}
