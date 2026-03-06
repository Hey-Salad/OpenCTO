import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AuthSession, OAuthProvider } from './types/auth'
import { AudioRealtimeView, type AudioMessage } from './components/audio/AudioRealtimeView'
import { AudioConfigPanel, type AudioConfig } from './components/audio/AudioConfigPanel'
import { AuthHttpClient } from './api/authClient'
import { getSavedChat, listSavedChats, saveChatSnapshot } from './api/chatClient'
import { getOnboardingState, saveOnboardingState } from './api/onboardingClient'
import {
  getGitHubStatus,
  listGitHubOrgs,
  listGitHubRepos,
  syncGitHubData,
  type GitHubConnectionStatus,
  type GitHubOrgSummary,
  type GitHubRepoSummary,
} from './api/githubClient'
import { normalizeApiError } from './lib/safeError'
import { RouteGuard } from './components/auth/RouteGuard'
import { AuthLoginPanel } from './components/auth/AuthLoginPanel'
import { OnboardingPanel } from './components/auth/OnboardingPanel'
import { CodebasePanel } from './components/codebase/CodebasePanel'
import { BillingHttpClient } from './api/billingClient'
import { deleteProviderKey, listProviderKeys, saveProviderKey, type ProviderKeySummary } from './api/llmKeysClient'
import { BillingDashboard } from './components/billing/BillingDashboard'
import { MarketplacePanel } from './components/marketplace/MarketplacePanel'
import { getApiBaseUrl } from './config/apiBase'
import type { OnboardingState } from './types/onboarding'
import type { BillingSummaryResponse, Invoice } from './types/billing'
import { getWorkspaceId, setWorkspaceId as persistWorkspaceId } from './lib/workspace'
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

function mergeMessageText(kind: AudioMessage['kind'], previousText: string, incomingText: string): string {
  if (!previousText.trim()) return incomingText
  if (!incomingText.trim()) return previousText

  if (kind === 'code' || kind === 'output' || kind === 'plan' || kind === 'artifact') {
    if (incomingText.startsWith(previousText)) return incomingText
    if (previousText.endsWith(incomingText)) return previousText
    return `${previousText}\n${incomingText}`.replace(/\n{3,}/g, '\n\n').trim()
  }

  if (kind === 'command') {
    if (incomingText.startsWith(previousText)) return incomingText
    if (previousText.endsWith(incomingText)) return previousText
    return `${previousText} ${incomingText}`.replace(/\s+/g, ' ').trim()
  }

  if (incomingText.startsWith(previousText)) return incomingText
  if (previousText.endsWith(incomingText)) return previousText
  return `${previousText} ${incomingText}`.replace(/\s+/g, ' ').trim()
}

function App() {
  const authApi = useMemo(
    () => new AuthHttpClient(`${getApiBaseUrl()}/api/v1`),
    [],
  )

  const [session, setSession] = useState<AuthSession | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authProviderLoading, setAuthProviderLoading] = useState<OAuthProvider | null>(null)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [audioConfig, setAudioConfig] = useState<AudioConfig>(DEFAULT_AUDIO_CONFIG)
  const [audioMessages, setAudioMessages] = useState<AudioMessage[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null)
  const [onboardingLoading, setOnboardingLoading] = useState(true)
  const [githubStatus, setGitHubStatus] = useState<GitHubConnectionStatus | null>(null)
  const [githubSyncing, setGitHubSyncing] = useState(false)
  const [githubSyncMessage, setGitHubSyncMessage] = useState<string | null>(null)
  const [githubOrgs, setGitHubOrgs] = useState<GitHubOrgSummary[]>([])
  const [githubRepos, setGitHubRepos] = useState<GitHubRepoSummary[]>([])
  const [selectedOrg, setSelectedOrg] = useState('')
  const [activeSection, setActiveSection] = useState<'launchpad' | 'codebase' | 'marketplace' | 'settings' | 'billing'>('launchpad')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [isExportingData, setIsExportingData] = useState(false)
  const [billingSummary, setBillingSummary] = useState<BillingSummaryResponse | null>(null)
  const [billingInvoices, setBillingInvoices] = useState<Invoice[]>([])
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [isBillingConfigured, setIsBillingConfigured] = useState(true)
  const [minimumLoaderComplete, setMinimumLoaderComplete] = useState(false)
  const [routeTransitionActive, setRouteTransitionActive] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string>(() => getWorkspaceId())
  const [providerKeys, setProviderKeys] = useState<ProviderKeySummary[]>([])
  const [providerKeyDrafts, setProviderKeyDrafts] = useState<Record<string, string>>({ openai: '', github: '' })
  const [providerKeysLoading, setProviderKeysLoading] = useState(false)
  const [providerKeysBusy, setProviderKeysBusy] = useState<string | null>(null)
  const [providerKeysMessage, setProviderKeysMessage] = useState<string | null>(null)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  const billingApi = useMemo(
    () => new BillingHttpClient(`${getApiBaseUrl()}/api/v1/billing`),
    [],
  )

  const handleAddMessage = useCallback((msg: AudioMessage) => {
    setAudioMessages((prev) => {
      if (prev.length === 0) return [msg]
      const last = prev[prev.length - 1]
      const canMerge =
        last.role === msg.role
        && last.role !== 'TOOL'
        && (last.kind ?? 'speech') === (msg.kind ?? 'speech')

      if (!canMerge) return [...prev, msg]

      const merged: AudioMessage = {
        ...last,
        text: mergeMessageText(last.kind ?? 'speech', last.text, msg.text),
        endMs: msg.endMs,
        timestamp: msg.timestamp,
        metadata: msg.metadata ? { ...(last.metadata ?? {}), ...msg.metadata } : last.metadata,
      }
      return [...prev.slice(0, -1), merged]
    })
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumLoaderComplete(true), 1400)
    return () => window.clearTimeout(timer)
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

  useEffect(() => {
    if (authLoading) {
      setOnboardingLoading(true)
      return
    }
    if (!session?.isAuthenticated) {
      setOnboardingState(null)
      setOnboardingLoading(false)
      setGitHubStatus(null)
      setGitHubOrgs([])
      setGitHubRepos([])
      return
    }
    let cancelled = false
    setOnboardingLoading(true)
    void (async () => {
      try {
        const state = await getOnboardingState()
        if (cancelled) return
        setOnboardingState(state)
      } catch (error) {
        if (cancelled) return
        setErrorMessage(normalizeApiError(error, 'Failed to load onboarding').message)
      } finally {
        if (!cancelled) setOnboardingLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, session?.isAuthenticated])

  useEffect(() => {
    if (!session?.isAuthenticated || !onboardingState?.completed) {
      setRouteTransitionActive(true)
      return
    }
    setRouteTransitionActive(false)
    const timer = window.setTimeout(() => setRouteTransitionActive(true), 35)
    return () => window.clearTimeout(timer)
  }, [activeSection, onboardingState?.completed, session?.isAuthenticated])

  useEffect(() => {
    if (!accountMenuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [accountMenuOpen])

  useEffect(() => {
    if (!session?.isAuthenticated || onboardingLoading || !onboardingState?.completed) return
    let cancelled = false
    void (async () => {
      try {
        const chats = await listSavedChats()
        if (cancelled || chats.length === 0) return
        const latest = chats[0]
        const loaded = await getSavedChat(latest.id)
        if (cancelled) return
        setActiveChatId(loaded.id)
        setAudioMessages(Array.isArray(loaded.messages) ? loaded.messages : [])
      } catch {
        // Non-blocking: user can continue even if chat history fails to load.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [onboardingLoading, onboardingState?.completed, session?.isAuthenticated])

  const refreshProviderKeys = useCallback(async () => {
    if (!session?.isAuthenticated) return
    setProviderKeysLoading(true)
    try {
      const keys = await listProviderKeys(workspaceId)
      setProviderKeys(keys)
      setProviderKeysMessage(null)
    } catch (error) {
      setProviderKeysMessage(normalizeApiError(error, 'Failed to load provider keys').message)
    } finally {
      setProviderKeysLoading(false)
    }
  }, [session?.isAuthenticated, workspaceId])

  useEffect(() => {
    void refreshProviderKeys()
  }, [refreshProviderKeys])

  useEffect(() => {
    if (!session?.isAuthenticated || !onboardingState?.completed || audioMessages.length === 0) return
    const timeout = window.setTimeout(() => {
      const title = audioMessages.find((m) => m.role === 'USER' && m.text.trim())?.text.slice(0, 80) ?? 'OpenCTO chat'
      void saveChatSnapshot({
        id: activeChatId ?? undefined,
        title,
        messages: audioMessages,
      })
        .then((saved) => {
          setActiveChatId(saved.id)
        })
        .catch(() => {})
    }, 1200)
    return () => window.clearTimeout(timeout)
  }, [activeChatId, audioMessages, onboardingState?.completed, session?.isAuthenticated])

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

  const handleOnboardingSubmit = async (payload: Parameters<typeof saveOnboardingState>[0]) => {
    const saved = await saveOnboardingState(payload)
    setOnboardingState(saved)
  }

  const handleWorkspaceIdChange = (nextWorkspaceId: string) => {
    const normalized = nextWorkspaceId.trim() || 'default'
    setWorkspaceId(normalized)
    persistWorkspaceId(normalized)
  }

  const handleSaveProviderKey = async (provider: 'openai' | 'github') => {
    const apiKey = providerKeyDrafts[provider]?.trim() ?? ''
    if (!apiKey) {
      setProviderKeysMessage(`Enter a ${provider.toUpperCase()} key before saving.`)
      return
    }
    setProviderKeysBusy(provider)
    try {
      await saveProviderKey(provider, apiKey, workspaceId)
      setProviderKeyDrafts((prev) => ({ ...prev, [provider]: '' }))
      setProviderKeysMessage(`${provider.toUpperCase()} key saved for workspace ${workspaceId}.`)
      await refreshProviderKeys()
    } catch (error) {
      setProviderKeysMessage(normalizeApiError(error, `Failed to save ${provider} key`).message)
    } finally {
      setProviderKeysBusy(null)
    }
  }

  const handleDeleteProviderKey = async (provider: 'openai' | 'github') => {
    setProviderKeysBusy(`delete:${provider}`)
    try {
      await deleteProviderKey(provider, workspaceId)
      setProviderKeysMessage(`${provider.toUpperCase()} key removed from workspace ${workspaceId}.`)
      await refreshProviderKeys()
    } catch (error) {
      setProviderKeysMessage(normalizeApiError(error, `Failed to delete ${provider} key`).message)
    } finally {
      setProviderKeysBusy(null)
    }
  }

  const handleSyncGitHub = async () => {
    if (!session?.isAuthenticated) return
    setGitHubSyncing(true)
    setGitHubSyncMessage(null)
    try {
      const result = await syncGitHubData()
      setGitHubSyncMessage(
        `Synced ${result.orgCount} orgs, ${result.repoCount} repos, ${result.prCount} PRs, ${result.checkRunCount} CI runs.`,
      )
      const status = await getGitHubStatus()
      setGitHubStatus(status)
      const orgs = await listGitHubOrgs()
      setGitHubOrgs(orgs)
      const repos = await listGitHubRepos(selectedOrg || undefined)
      setGitHubRepos(repos)
    } catch (error) {
      setGitHubSyncMessage(normalizeApiError(error, 'Failed to sync GitHub data').message)
    } finally {
      setGitHubSyncing(false)
    }
  }

  const handleConnectGitHub = async () => {
    try {
      await authApi.signInWithProvider('github')
    } catch (error) {
      setErrorMessage(normalizeApiError(error, 'Failed to connect GitHub').message)
    }
  }

  useEffect(() => {
    if (!session?.isAuthenticated || !onboardingState?.completed) return
    let cancelled = false
    void (async () => {
      try {
        const [status, orgs, repos] = await Promise.all([
          getGitHubStatus(),
          listGitHubOrgs(),
          listGitHubRepos(selectedOrg || undefined),
        ])
        if (cancelled) return
        setGitHubStatus(status)
        setGitHubOrgs(orgs)
        setGitHubRepos(repos)
      } catch {
        if (cancelled) return
      }
    })()
    return () => {
      cancelled = true
    }
  }, [onboardingState?.completed, selectedOrg, session?.isAuthenticated])

  useEffect(() => {
    if (activeSection !== 'billing' || !session?.isAuthenticated) return
    let cancelled = false
    setBillingLoading(true)
    setBillingError(null)
    void (async () => {
      const [summaryResult, invoicesResult] = await Promise.allSettled([
        billingApi.getSubscriptionSummary(),
        billingApi.getInvoices(),
      ])
      if (cancelled) return

      if (summaryResult.status === 'fulfilled') {
        setBillingSummary(summaryResult.value)
      } else {
        setBillingSummary(null)
      }

      if (invoicesResult.status === 'fulfilled') {
        setBillingInvoices(invoicesResult.value.invoices ?? [])
      } else {
        setBillingInvoices([])
      }

      if (summaryResult.status === 'rejected' && invoicesResult.status === 'rejected') {
        const normalized = normalizeApiError(summaryResult.reason, 'Failed to load billing')
        setBillingError(normalized.message)
        setIsBillingConfigured(normalized.code !== 'CONFIG_ERROR')
      } else if (summaryResult.status === 'rejected') {
        const normalized = normalizeApiError(summaryResult.reason, 'Failed to load billing summary')
        setBillingError(normalized.message)
        setIsBillingConfigured(normalized.code !== 'CONFIG_ERROR')
      } else if (invoicesResult.status === 'rejected') {
        setBillingError(normalizeApiError(invoicesResult.reason, 'Failed to load invoices').message)
        setIsBillingConfigured(true)
      } else {
        setBillingError(null)
        setIsBillingConfigured(true)
      }

      if (!cancelled) setBillingLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [activeSection, billingApi, session?.isAuthenticated])

  const handleSignOut = () => {
    authApi.signOut?.()
    setSession({
      isAuthenticated: false,
      trustedDevice: false,
      mfaRequired: false,
      user: null,
    })
    setAudioMessages([])
    setActiveChatId(null)
    setOnboardingState(null)
    setGitHubStatus(null)
    setGitHubOrgs([])
    setGitHubRepos([])
    setSelectedOrg('')
    setActiveSection('launchpad')
    setAccountMenuOpen(false)
    setErrorMessage(null)
  }

  const handleExportData = () => {
    if (!session?.user) return
    setIsExportingData(true)
    try {
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        product: 'OpenCTO Dashboard',
        account: {
          id: session.user.id,
          email: session.user.email,
          displayName: session.user.displayName,
          role: session.user.role,
          authProvider: session.user.authProvider ?? 'unknown',
        },
        workspace: onboardingState,
        preferences: {
          audioConfig,
        },
        chatHistory: {
          activeChatId,
          messageCount: audioMessages.length,
          messages: audioMessages,
        },
      }

      const json = JSON.stringify(exportPayload, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      anchor.href = url
      anchor.download = `opencto-export-${stamp}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setErrorMessage(normalizeApiError(error, 'Failed to export account data').message)
    } finally {
      setIsExportingData(false)
    }
  }

  const showWorkspaceLoader = !minimumLoaderComplete || authLoading || (session?.isAuthenticated && onboardingLoading)
  const loaderStatusMessage = authLoading
    ? 'Checking secure session state'
    : session?.isAuthenticated && onboardingLoading
      ? 'Loading onboarding and workspace access'
      : 'Loading your workspace'

  if (showWorkspaceLoader) {
    return (
      <main className="workspace-loader-screen" aria-label="Loading workspace">
        <div className="workspace-loader-card">
          <div className="workspace-loader-logo" aria-hidden="true">
            <svg viewBox="0 0 84 84" fill="none">
              <rect x="2" y="2" width="80" height="80" rx="18" fill="#ed4c4c" />
              <path d="M 18,62 A 26 26 0 1 1 66,36" stroke="white" strokeWidth="6" strokeLinecap="round" />
              <circle cx="18" cy="62" r="3.5" fill="#ffd0cd" />
              <circle cx="66" cy="36" r="3.5" fill="#ffd0cd" />
              <polyline points="30,39 40,47 30,55" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="38,43 48,50 38,57" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1>OpenCTO</h1>
          <p>{loaderStatusMessage}</p>
          <div className="workspace-loader-progress" aria-hidden="true">
            <div className="workspace-loader-progress-fill" />
          </div>
        </div>
      </main>
    )
  }

  const isCenterOnlySection = activeSection === 'codebase' || activeSection === 'marketplace'

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
      {session?.isAuthenticated && onboardingLoading ? (
        <main className="app-shell unauth-shell">
          <section className="panel onboarding-panel">
            <div className="onboarding-header">
              <h2>Preparing your workspace...</h2>
              <p className="muted">Loading onboarding status.</p>
            </div>
          </section>
        </main>
      ) : session?.isAuthenticated && !onboardingState?.completed ? (
        <main className="app-shell unauth-shell">
          <OnboardingPanel
            initialState={onboardingState}
            onSubmit={handleOnboardingSubmit}
          />
        </main>
      ) : (
      <main className={`app-shell ${isCenterOnlySection ? 'app-shell-codebase' : ''}`}>
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
          <div className="top-bar-meta">
            {session?.isAuthenticated && session.user && (
              <div ref={accountMenuRef} className="user-chip" aria-label="Current user">
                <button
                  type="button"
                  className="user-chip-avatar user-chip-avatar-btn"
                  aria-label="Open account menu"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="7" r="3.3" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M4 16c.7-2.5 2.9-4 6-4s5.3 1.5 6 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="user-chip-toggle"
                  aria-label="Open account menu"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                >
                  <div className="user-chip-meta">
                    <strong>{session.user.displayName || 'OpenCTO User'}</strong>
                    <span>{session.user.email}</span>
                  </div>
                  <svg
                    className={`user-chip-chevron ${accountMenuOpen ? 'user-chip-chevron-open' : ''}`}
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M4 6.5L8 10L12 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {accountMenuOpen && (
                  <div className="account-menu panel" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setActiveSection('settings'); setAccountMenuOpen(false) }}>
                      <span className="account-menu-item-content">
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M9.5 1.8L10 3.1c.4.1.8.3 1.1.5l1.3-.5 1 1.8-1 .9c.1.4.1.8 0 1.2l1 .9-1 1.8-1.3-.5c-.3.2-.7.4-1.1.5l-.5 1.3h-2l-.5-1.3c-.4-.1-.8-.3-1.1-.5l-1.3.5-1-1.8 1-.9a3.7 3.7 0 010-1.2l-1-.9 1-1.8 1.3.5c.3-.2.7-.4 1.1-.5l.5-1.3h2Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                          <circle cx="8" cy="8" r="1.9" stroke="currentColor" strokeWidth="1.15" />
                        </svg>
                        <span>Settings</span>
                      </span>
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setActiveSection('billing'); setAccountMenuOpen(false) }}>
                      <span className="account-menu-item-content">
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="2" stroke="currentColor" strokeWidth="1.25" />
                          <path d="M1.8 6.3h12.4" stroke="currentColor" strokeWidth="1.25" />
                          <path d="M4.2 10.1h3.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                        </svg>
                        <span>Billing</span>
                      </span>
                    </button>
                    <button type="button" role="menuitem" onClick={handleSignOut}>
                      <span className="account-menu-item-content">
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M10 2.5H4.6A1.6 1.6 0 0 0 3 4.1v7.8a1.6 1.6 0 0 0 1.6 1.6H10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                          <path d="M8.5 8h6M12.2 5.2L15 8l-2.8 2.8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>Logout</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <aside className="left-sidebar panel" aria-label="Main navigation">
          <button type="button" className={`nav-item ${activeSection === 'launchpad' ? 'nav-item-active' : ''}`} onClick={() => setActiveSection('launchpad')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5C8 1.5 11.5 3.5 11.5 8C11.5 10.5 10 12.5 8 13.5C6 12.5 4.5 10.5 4.5 8C4.5 3.5 8 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
              <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
              <path d="M8 13.5V15" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              <path d="M5 14.5L6 12.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              <path d="M11 14.5L10 12.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
            Launchpad
          </button>
          <button type="button" className={`nav-item ${activeSection === 'codebase' ? 'nav-item-active' : ''}`} onClick={() => setActiveSection('codebase')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.5" y="2" width="13" height="11.5" rx="2" stroke="currentColor" strokeWidth="1.25" />
              <path d="M5 6h6M5 9h6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            Codebase
          </button>
          <button type="button" className={`nav-item ${activeSection === 'marketplace' ? 'nav-item-active' : ''}`} onClick={() => setActiveSection('marketplace')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.75" y="4" width="12.5" height="9.75" rx="2" stroke="currentColor" strokeWidth="1.25" />
              <path d="M1.75 6.75h12.5" stroke="currentColor" strokeWidth="1.25" />
              <path d="M5.5 6.75v-1a2.5 2.5 0 0 1 5 0v1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            Marketplace
          </button>
        </aside>

        <section className={`center-column route-content ${routeTransitionActive ? 'route-content-active' : ''}`}>
          {errorMessage && (
            <section className="panel">
              <p className="billing-error">{errorMessage}</p>
            </section>
          )}

          {activeSection === 'launchpad' && (
            <AudioRealtimeView
              messages={audioMessages}
              onAddMessage={handleAddMessage}
              audioConfig={audioConfig}
            />
          )}
          {activeSection === 'codebase' && (
            <CodebasePanel
              status={githubStatus}
              syncMessage={githubSyncMessage}
              syncing={githubSyncing}
              orgs={githubOrgs}
              repos={githubRepos}
              selectedOrg={selectedOrg}
              onSelectOrg={setSelectedOrg}
              onSync={handleSyncGitHub}
              onConnect={handleConnectGitHub}
            />
          )}
          {activeSection === 'marketplace' && (
            <MarketplacePanel />
          )}
          {activeSection === 'settings' && (
            <section className="panel settings-panel">
              <div className="settings-panel-header">
                <div>
                  <h2>Settings</h2>
                  <p className="muted">Manage your OpenCTO account profile and workspace preferences.</p>
                </div>
                <button type="button" className="secondary-button" onClick={handleSignOut}>
                  Logout
                </button>
              </div>

              <div className="settings-layout">
                <article className="settings-card">
                  <h3>Account</h3>
                  <div className="settings-summary">
                    <p><strong>Name:</strong> {session?.user?.displayName ?? 'OpenCTO User'}</p>
                    <p><strong>Email:</strong> {session?.user?.email ?? '-'}</p>
                    <p><strong>Role:</strong> {session?.user?.role ?? '-'}</p>
                    <p><strong>Provider:</strong> {session?.user?.authProvider ?? 'Unknown'}</p>
                  </div>
                </article>

                <article className="settings-card">
                  <h3>Workspace</h3>
                  <div className="settings-summary">
                    <p><strong>Workspace:</strong> {onboardingState?.companyName ?? 'Not set'}</p>
                    <p><strong>Team Size:</strong> {onboardingState?.teamSize || 'Not set'}</p>
                    <p><strong>Terms Accepted:</strong> {onboardingState?.termsAccepted ? 'Yes' : 'No'}</p>
                  </div>
                </article>

                <article className="settings-card settings-card-actions">
                  <h3>Data Actions</h3>
                  <p className="muted">Export your workspace data as a local JSON file.</p>
                  <div className="settings-action-row">
                    <button type="button" className="secondary-button" onClick={handleExportData} disabled={isExportingData}>
                      {isExportingData ? 'Exporting...' : 'Export Data'}
                    </button>
                  </div>
                </article>

                <article className="settings-card settings-card-actions">
                  <h3>Model Provider Keys (BYOK)</h3>
                  <p className="muted">
                    Store provider keys per workspace. These keys override shared backend defaults for your requests.
                  </p>
                  <div className="settings-summary">
                    <label className="settings-key-label" htmlFor="workspace-id-input">
                      Workspace ID
                    </label>
                    <input
                      id="workspace-id-input"
                      className="audio-text-input"
                      value={workspaceId}
                      onChange={(event) => handleWorkspaceIdChange(event.target.value)}
                      placeholder="default"
                    />
                  </div>
                  <div className="settings-key-grid">
                    {(['openai', 'github'] as const).map((provider) => {
                      const existing = providerKeys.find((item) => item.provider === provider)
                      const saving = providerKeysBusy === provider
                      const deleting = providerKeysBusy === `delete:${provider}`
                      return (
                        <div key={provider} className="settings-key-row">
                          <div className="settings-key-row-header">
                            <strong>{provider.toUpperCase()}</strong>
                            <span className="muted">{existing ? `Saved: ${existing.keyHint}` : 'No key saved'}</span>
                          </div>
                          <input
                            className="audio-text-input"
                            value={providerKeyDrafts[provider] ?? ''}
                            onChange={(event) => {
                              const next = event.target.value
                              setProviderKeyDrafts((prev) => ({ ...prev, [provider]: next }))
                            }}
                            placeholder={`Paste ${provider.toUpperCase()} API key`}
                          />
                          <div className="settings-action-row">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => { void handleSaveProviderKey(provider) }}
                              disabled={saving || providerKeysLoading}
                            >
                              {saving ? 'Saving...' : 'Save Key'}
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => { void handleDeleteProviderKey(provider) }}
                              disabled={deleting || providerKeysLoading || !existing}
                            >
                              {deleting ? 'Removing...' : 'Remove Key'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {providerKeysLoading && <p className="muted">Loading provider keys...</p>}
                  {providerKeysMessage && <p className="muted">{providerKeysMessage}</p>}
                </article>
              </div>
            </section>
          )}
          {activeSection === 'billing' && (
            <BillingDashboard
              summary={billingSummary}
              invoices={billingInvoices}
              isSummaryLoading={billingLoading}
              isInvoicesLoading={billingLoading}
              summaryError={billingError}
              invoicesError={billingError}
              isBillingConfigured={isBillingConfigured}
              onUpgrade={() => {
                void billingApi.createCheckoutSession('TEAM', 'MONTHLY')
                  .then((sessionData) => {
                    window.location.href = sessionData.checkoutUrl
                  })
                  .catch((error) => {
                    const normalized = normalizeApiError(error, 'Failed to start checkout')
                    setErrorMessage(normalized.message)
                    if (normalized.code === 'CONFIG_ERROR') setIsBillingConfigured(false)
                  })
              }}
              onManage={() => {
                void billingApi.createBillingPortalSession()
                  .then((portal) => {
                    window.location.href = portal.url
                  })
                  .catch((error) => {
                    const normalized = normalizeApiError(error, 'Failed to open billing portal')
                    setErrorMessage(normalized.message)
                    if (normalized.code === 'CONFIG_ERROR') setIsBillingConfigured(false)
                  })
              }}
            />
          )}
        </section>

        {activeSection === 'launchpad' ? (
          <AudioConfigPanel config={audioConfig} onConfigChange={setAudioConfig} />
        ) : isCenterOnlySection ? null : (
          <aside className="right-config panel">
            <p className="muted">Workspace settings and billing controls appear here.</p>
          </aside>
        )}
      </main>
      )}
    </RouteGuard>
  )
}

export default App
