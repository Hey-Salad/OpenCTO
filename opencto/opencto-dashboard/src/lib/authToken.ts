const AUTH_TOKEN_KEY = 'opencto_auth_token'

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredAuthToken(token: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
  } catch {
    // ignore
  }
}

export function clearStoredAuthToken(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    // ignore
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredAuthToken()
  if (token) return { Authorization: `Bearer ${token}` }
  if (import.meta.env.DEV) return { Authorization: 'Bearer demo-token' }
  return {}
}

export function consumeAuthTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  if (!hash.startsWith('#')) return null
  const params = new URLSearchParams(hash.slice(1))
  const token = params.get('auth_token')
  if (!token) return null
  setStoredAuthToken(token)
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  return token
}
