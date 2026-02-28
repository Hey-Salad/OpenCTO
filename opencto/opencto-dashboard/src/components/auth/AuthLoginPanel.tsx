import type { OAuthProvider } from '../../types/auth'

interface AuthLoginPanelProps {
  onProviderLogin: (provider: OAuthProvider) => void
  loadingProvider: OAuthProvider | null
}

const PROVIDERS: Array<{ key: OAuthProvider; label: string; subtitle: string }> = [
  { key: 'google', label: 'Continue with Google', subtitle: 'OAuth provider' },
  { key: 'github', label: 'Continue with GitHub', subtitle: 'Developer identity' },
  { key: 'cloudflare', label: 'Continue with Cloudflare', subtitle: 'Infrastructure identity' },
]

export function AuthLoginPanel({ onProviderLogin, loadingProvider }: AuthLoginPanelProps) {
  return (
    <section className="panel auth-login-panel" aria-label="Provider login">
      <h3>Sign in</h3>
      <p className="muted">Use your developer identity provider to access OpenCTO.</p>
      <div className="auth-provider-list">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.key}
            type="button"
            className="auth-provider-btn"
            onClick={() => onProviderLogin(provider.key)}
            disabled={loadingProvider !== null}
          >
            <span>{provider.label}</span>
            <small>{provider.subtitle}</small>
            {loadingProvider === provider.key ? <em>Connecting...</em> : null}
          </button>
        ))}
      </div>
      <p className="muted auth-policy-note">
        Super-admin policy: any verified user with <code>@salad.hr</code> is granted owner-level access.
      </p>
    </section>
  )
}
