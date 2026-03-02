import { normalizeApiError, safeFetchJson } from '../lib/safeError'
import { clearStoredAuthToken, consumeAuthTokenFromHash, getAuthHeaders } from '../lib/authToken'
import { getApiBaseUrl } from '../config/apiBase'
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
  signOut?: () => void
  deleteAccount?: () => Promise<void>
  getTrustedDevices: () => Promise<TrustedDevice[]>
  revokeDevice: (deviceId: string) => Promise<TrustedDevice>
  listPasskeys: () => Promise<PasskeyCredential[]>
  startPasskeyEnrollment: () => Promise<PasskeyEnrollmentStart>
  completePasskeyEnrollment: (challengeResponse: string) => Promise<PasskeyEnrollmentComplete>
}

const DEFAULT_API_BASE = `${getApiBaseUrl()}/api/v1`

export class AuthHttpClient implements AuthApi {
  constructor(private readonly baseUrl = DEFAULT_API_BASE) {}

  async getSession(): Promise<AuthSession> {
    try {
      consumeAuthTokenFromHash()
      return await safeFetchJson<AuthSession>(
        `${this.baseUrl}/auth/session`,
        { headers: getAuthHeaders() },
        'Failed to load auth session',
      )
    } catch (error) {
      throw normalizeApiError(error, 'Failed to load auth session')
    }
  }

  async signInWithProvider(provider: OAuthProvider): Promise<AuthSession> {
    if (provider === 'github' && typeof window !== 'undefined') {
      const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search}`
      window.location.href = `${this.baseUrl}/auth/oauth/github/start?returnTo=${encodeURIComponent(returnTo)}`
      return new Promise<AuthSession>(() => {})
    }
    return this.getSession()
  }

  async getTrustedDevices(): Promise<TrustedDevice[]> {
    try {
      return await safeFetchJson<TrustedDevice[]>(
        `${this.baseUrl}/auth/devices`,
        { headers: getAuthHeaders() },
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
            ...getAuthHeaders(),
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
        { headers: getAuthHeaders() },
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
            ...getAuthHeaders(),
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
            ...getAuthHeaders(),
            'x-idempotency-key': `passkey-complete-${Date.now()}`,
          },
        },
        'Failed to complete passkey enrollment',
      )
    } catch (error) {
      throw normalizeApiError(error, 'Failed to complete passkey enrollment')
    }
  }

  signOut(): void {
    clearStoredAuthToken()
  }

  async deleteAccount(): Promise<void> {
    try {
      await safeFetchJson<{ deleted: boolean }>(
        `${this.baseUrl}/auth/account`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        },
        'Failed to delete account',
      )
      clearStoredAuthToken()
    } catch (error) {
      throw normalizeApiError(error, 'Failed to delete account')
    }
  }
}
