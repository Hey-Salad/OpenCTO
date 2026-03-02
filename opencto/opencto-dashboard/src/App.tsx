import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AuthSession, OAuthProvider } from './types/auth'
import { AudioRealtimeView, type AudioMessage } from './components/audio/AudioRealtimeView'
import { AudioConfigPanel, type AudioConfig } from './components/audio/AudioConfigPanel'
import { AuthMockAdapter } from './mocks/authMockAdapter'
import { normalizeApiError } from './lib/safeError'
import { RouteGuard } from './components/auth/RouteGuard'
import { AuthLoginPanel } from './components/auth/AuthLoginPanel'
import './index.css'

const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  systemInstructions: 'You are an OpenCTO AI engineering agent. Help users build, review, and deploy software.',
  voice: 'sage',
  turnDetection: true,
  threshold: 0.65,
  prefixPadding: 300,
  silenceDuration: 500,
  idleTimeout: true,
  voiceModel: 'gpt-realtime-1.5',
  reasoningModel: 'github/openai/gpt-5-mini',
  transcriptModel: 'gpt-4o-mini-transcribe',
  noiseReduction: true,
  maxTokens: 4096,
}

function App() {
  const authApi = useMemo(() => new AuthMockAdapter(), [])

  const [session, setSession] = useState<AuthSession | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authProviderLoading, setAuthProviderLoading] = useState<OAuthProvider | null>(null)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [audioConfig, setAudioConfig] = useState<AudioConfig>(DEFAULT_AUDIO_CONFIG)
  const [audioMessages, setAudioMessages] = useState<AudioMessage[]>([])

  const handleAddMessage = useCallback((msg: AudioMessage) => {
    setAudioMessages((prev) => [...prev, msg])
  }, [])

  useEffect(() => {
    authApi
      .getSession()
      .then(setSession)
      .catch((error) => {
        setErrorMessage(normalizeApiError(error, 'Failed to load session').message)
      })
      .finally(() => setAuthLoading(false))
  }, [authApi])

  const handleProviderLogin = async (provider: OAuthProvider) => {
    try {
      setAuthProviderLoading(provider)
      const nextSession = await authApi.signInWithProvider(provider)
      setSession(nextSession)
    } catch (error) {
      setErrorMessage(normalizeApiError(error, 'Sign-in failed').message)
    } finally {
      setAuthProviderLoading(null)
    }
  }

  return (
    <RouteGuard
      session={session}
      isLoading={authLoading}
      fallback={
        <main className="app-shell unauth-shell">
          <section className="panel auth-brand-panel">
            <div className="brand-mark">
              <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <rect width="28" height="28" rx="6" fill="#ed4c4c" />
                <path d="M 6,21 A 9.5 9.5 0 1 1 22,13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="6" cy="21" r="1.5" fill="#ffd0cd" />
                <circle cx="22" cy="13" r="1.5" fill="#ffd0cd" />
                <polyline points="9,14 13,17 9,20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="12,15.5 16,18.5 12,21.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h2>OpenCTO</h2>
            </div>
            <h3>Authentication Required</h3>
            <p className="muted">Sign in with a trusted device to access OpenCTO.</p>
          </section>
          <AuthLoginPanel onProviderLogin={handleProviderLogin} loadingProvider={authProviderLoading} />
        </main>
      }
    >
      <main className="app-shell">
        <header className="top-bar panel">
          <div className="brand-mark">
            <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="6" fill="#ed4c4c" />
              <path d="M 6,21 A 9.5 9.5 0 1 1 22,13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="6" cy="21" r="1.5" fill="#ffd0cd" />
              <circle cx="22" cy="13" r="1.5" fill="#ffd0cd" />
              <polyline points="9,14 13,17 9,20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="12,15.5 16,18.5 12,21.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1>OpenCTO</h1>
          </div>
          <div className="top-bar-meta" />
        </header>

        <aside className="left-sidebar panel" aria-label="Main navigation">
          <button type="button" className="nav-item nav-item-active">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5C8 1.5 11.5 3.5 11.5 8C11.5 10.5 10 12.5 8 13.5C6 12.5 4.5 10.5 4.5 8C4.5 3.5 8 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
              <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
              <path d="M8 13.5V15" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              <path d="M5 14.5L6 12.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              <path d="M11 14.5L10 12.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
            Launchpad
          </button>
        </aside>

        <section className="center-column">
          {errorMessage && (
            <section className="panel">
              <p className="billing-error">{errorMessage}</p>
            </section>
          )}

          <AudioRealtimeView
            messages={audioMessages}
            onAddMessage={handleAddMessage}
            audioConfig={audioConfig}
          />
        </section>

        <AudioConfigPanel config={audioConfig} onConfigChange={setAudioConfig} />
      </main>
    </RouteGuard>
  )
}

export default App
