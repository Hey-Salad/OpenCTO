import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Job, Step } from './types/opencto'
import type { AuthSession, OAuthProvider, PasskeyCredential, TrustedDevice } from './types/auth'
import type { ComplianceCheck } from './types/compliance'
import type {
  BillingInterval,
  BillingSummaryResponse,
  EntitlementContext,
  Invoice,
  PlanCode,
} from './types/billing'
import { JobsListScreen, type JobFilter } from './components/jobs/JobsListScreen'
import { JobDetailStream } from './components/stream/JobDetailStream'
import { PricingPage } from './components/billing/PricingPage'
import { BillingDashboard } from './components/billing/BillingDashboard'
import { AudioRealtimeView, type AudioMessage } from './components/audio/AudioRealtimeView'
import { AudioConfigPanel, type AudioConfig } from './components/audio/AudioConfigPanel'
import { MockOpenCtoAdapter } from './mocks/openctoMockAdapter'
import { BillingMockAdapter, plans } from './mocks/billingMockAdapter'
import { AuthMockAdapter } from './mocks/authMockAdapter'
import { ComplianceMockAdapter } from './mocks/complianceMockAdapter'
import { getStripeMissingEnvVars } from './config/stripe'
import { normalizeApiError } from './lib/safeError'
import { evaluateEntitlement } from './utils/entitlements'
import { RouteGuard } from './components/auth/RouteGuard'
import { RoleGuard } from './components/auth/RoleGuard'
import { AuthLoginPanel } from './components/auth/AuthLoginPanel'
import { SecuritySettings } from './components/settings/SecuritySettings'
import { ComplianceEvidencePanel } from './components/compliance/ComplianceEvidencePanel'
import './index.css'

type AppView = 'jobs' | 'launchpad' | 'pricing' | 'billing' | 'compliance' | 'settings'

const DEMO_AUDIO_MESSAGES: AudioMessage[] = [
  {
    id: 'msg-1',
    role: 'USER',
    text: 'Hey, can you help me set up a CI/CD pipeline for our new microservice? We need SOC2 compliance baked in from the start.',
    timestamp: '00:03',
    startMs: 3000,
    endMs: 12000,
  },
  {
    id: 'msg-2',
    role: 'ASSISTANT',
    text: 'Absolutely. I\'ll scaffold a pipeline with compliance gates built in. First, let me check your current infrastructure setup and identify which SOC2 controls apply to your deployment flow.',
    timestamp: '00:14',
    startMs: 14000,
    endMs: 26000,
  },
  {
    id: 'msg-3',
    role: 'USER',
    text: 'We\'re using Kubernetes on AWS EKS, and we deploy through GitHub Actions. The service handles payment webhooks, so PCI-DSS is relevant too.',
    timestamp: '00:28',
    startMs: 28000,
    endMs: 39000,
  },
  {
    id: 'msg-4',
    role: 'ASSISTANT',
    text: 'Got it. For a payment-handling service on EKS with GitHub Actions, I\'ll configure the pipeline with: image scanning via Trivy, SAST analysis, dependency audit, secret detection in diffs, and a human approval gate before production deployment. The compliance mapping covers SOC2 CC8.1 and PCI-DSS Requirement 6.3.',
    timestamp: '00:41',
    startMs: 41000,
    endMs: 62000,
  },
  {
    id: 'msg-5',
    role: 'USER',
    text: 'Perfect. Can you also add automatic rollback if the health checks fail post-deploy? We had an incident last month where a bad deploy stayed up for twenty minutes.',
    timestamp: '01:05',
    startMs: 65000,
    endMs: 78000,
  },
  {
    id: 'msg-6',
    role: 'ASSISTANT',
    text: 'I\'ll add a progressive rollout with automated rollback. The deploy will use a canary strategy — 10% traffic first, then 50%, then full. If error rates exceed the threshold or health probes fail within 90 seconds, it auto-reverts to the previous stable revision. This also satisfies DORA Article 9 for operational resilience.',
    timestamp: '01:20',
    startMs: 80000,
    endMs: 102000,
  },
  {
    id: 'msg-7',
    role: 'USER',
    text: 'That sounds great. How long will it take to have a working draft I can review?',
    timestamp: '01:44',
    startMs: 104000,
    endMs: 112000,
  },
  {
    id: 'msg-8',
    role: 'ASSISTANT',
    text: 'I\'m generating the pipeline configuration now. You\'ll have the GitHub Actions workflow, the Kubernetes manifests with canary config, and the compliance evidence mapping ready for review in your OpenCTO dashboard. I\'ll flag anything that needs your input with an approval card.',
    timestamp: '01:54',
    startMs: 114000,
    endMs: 132000,
  },
  {
    id: 'msg-9',
    role: 'USER',
    text: 'One more thing — we need to make sure the container images are signed. Our security team just mandated Sigstore cosign for everything going to production.',
    timestamp: '02:15',
    startMs: 135000,
    endMs: 148000,
  },
  {
    id: 'msg-10',
    role: 'ASSISTANT',
    text: 'Adding cosign image signing to the pipeline now. The build step will sign each image with a keyless workflow through Fulcio, and the deployment controller will verify signatures before admitting any container. I\'ll also add a compliance check that blocks unsigned images — that covers PCI-DSS Req 6.5.3 for software supply chain integrity.',
    timestamp: '02:30',
    startMs: 150000,
    endMs: 175000,
  },
  {
    id: 'msg-11',
    role: 'USER',
    text: 'Excellent. Let me know when the draft is ready. I\'ll pull in our security lead for the review.',
    timestamp: '02:58',
    startMs: 178000,
    endMs: 186000,
  },
  {
    id: 'msg-12',
    role: 'ASSISTANT',
    text: 'Draft is ready. I\'ve created a job in your dashboard with full compliance evidence attached — 12 controls verified across SOC2, PCI-DSS, and DORA. The pipeline config is in a new branch called "ci/payment-webhook-pipeline". You and your security lead can review and approve the production deploy from the approval card.',
    timestamp: '03:08',
    startMs: 188000,
    endMs: 214000,
  },
]

const DEMO_TOTAL_DURATION_MS = 220000

const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  systemInstructions: 'You are an OpenCTO AI engineering agent. Help users set up compliant CI/CD pipelines, review code, and deploy with SOC2, DORA, NIS2, and PCI-DSS compliance built in.',
  voice: 'sage',
  turnDetection: true,
  threshold: 0.65,
  prefixPadding: 300,
  silenceDuration: 500,
  idleTimeout: true,
  model: 'opencto-realtime-v1',
  transcriptModel: 'cheri-ml-transcribe',
  noiseReduction: true,
  maxTokens: 4096,
}

function App() {
  const jobsApi = useMemo(() => new MockOpenCtoAdapter(), [])
  const billingApi = useMemo(() => new BillingMockAdapter(), [])
  const authApi = useMemo(() => new AuthMockAdapter(), [])
  const complianceApi = useMemo(() => new ComplianceMockAdapter(), [])

  const [view, setView] = useState<AppView>('launchpad')

  const [jobs, setJobs] = useState<Job[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [activeFilter, setActiveFilter] = useState<JobFilter>('ALL')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const [session, setSession] = useState<AuthSession | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authProviderLoading, setAuthProviderLoading] = useState<OAuthProvider | null>(null)
  const [devices, setDevices] = useState<TrustedDevice[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([])
  const [passkeysLoading, setPasskeysLoading] = useState(false)

  const [checks, setChecks] = useState<ComplianceCheck[]>([])
  const [checksLoading, setChecksLoading] = useState(false)

  const [billingInterval, setBillingInterval] = useState<BillingInterval>('MONTHLY')
  const [billingSummary, setBillingSummary] = useState<BillingSummaryResponse | null>(null)
  const [billingInvoices, setBillingInvoices] = useState<Invoice[]>([])
  const [isBillingSummaryLoading, setIsBillingSummaryLoading] = useState(false)
  const [isBillingInvoicesLoading, setIsBillingInvoicesLoading] = useState(false)
  const [billingSummaryError, setBillingSummaryError] = useState<string | null>(null)
  const [billingInvoicesError, setBillingInvoicesError] = useState<string | null>(null)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Audio state
  const [audioMessages] = useState<AudioMessage[]>(DEMO_AUDIO_MESSAGES)
  const [audioConfig, setAudioConfig] = useState<AudioConfig>(DEFAULT_AUDIO_CONFIG)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [isMicActive, setIsMicActive] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Audio playback simulation
  useEffect(() => {
    if (isAudioPlaying) {
      audioTimerRef.current = setInterval(() => {
        setAudioCurrentTime((prev) => {
          if (prev >= DEMO_TOTAL_DURATION_MS) {
            setIsAudioPlaying(false)
            return DEMO_TOTAL_DURATION_MS
          }
          return prev + 100
        })
      }, 100)
    } else if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current)
      audioTimerRef.current = null
    }
    return () => {
      if (audioTimerRef.current) clearInterval(audioTimerRef.current)
    }
  }, [isAudioPlaying])

  const handleAudioTogglePlay = useCallback(() => {
    if (audioCurrentTime >= DEMO_TOTAL_DURATION_MS) {
      setAudioCurrentTime(0)
    }
    setIsAudioPlaying((prev) => !prev)
  }, [audioCurrentTime])

  const handleAudioSeek = useCallback((ms: number) => {
    setAudioCurrentTime(ms)
  }, [])

  const handleAudioGenerate = useCallback(() => {
    setIsGenerating((prev) => !prev)
  }, [])

  const handleAudioMicToggle = useCallback(() => {
    setIsMicActive((prev) => !prev)
  }, [])

  const handleAudioStop = useCallback(() => {
    setIsAudioPlaying(false)
    setAudioCurrentTime(0)
    setIsGenerating(false)
    setIsMicActive(false)
  }, [])

  const missingStripeVars = getStripeMissingEnvVars()
  const isBillingConfigured = missingStripeVars.length === 0

  const entitlementContext: EntitlementContext = {
    planCode: billingSummary?.subscription.planCode ?? 'DEVELOPER',
    usage: {
      jobsUsed: billingSummary?.usage.jobsUsed ?? 44,
      jobsLimit: billingSummary?.usage.jobsLimit ?? 50,
      workersUsed: billingSummary?.usage.workersUsed ?? 2,
      workersLimit: billingSummary?.usage.workersLimit ?? 2,
      usersUsed: billingSummary?.usage.usersUsed ?? 1,
      usersLimit: billingSummary?.usage.usersLimit ?? 1,
    },
  }

  const createJobDecision = evaluateEntitlement(entitlementContext, 'CREATE_JOB')
  const dangerousApprovalDecision = evaluateEntitlement(entitlementContext, 'APPROVE_DANGEROUS_STEP')
  const evidenceExportDecision = evaluateEntitlement(entitlementContext, 'EXPORT_EVIDENCE_PACKAGE')

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
    jobsApi.listJobs().then((items) => {
      setJobs(items)
      if (items.length > 0) {
        setSelectedJobId(items[0].id)
      }
    })
  }, [jobsApi])

  useEffect(() => {
    if (selectedJobId) {
      jobsApi.listSteps(selectedJobId).then(setSteps)
    }
  }, [jobsApi, selectedJobId])

  useEffect(() => {
    if (view !== 'settings') {
      return
    }

    authApi
      .getTrustedDevices()
      .then(setDevices)
      .catch((error) => setErrorMessage(normalizeApiError(error, 'Failed to load devices').message))
      .finally(() => setDevicesLoading(false))

    authApi
      .listPasskeys()
      .then(setPasskeys)
      .catch((error) => setErrorMessage(normalizeApiError(error, 'Failed to load passkeys').message))
      .finally(() => setPasskeysLoading(false))
  }, [authApi, view])

  useEffect(() => {
    if (view !== 'compliance') {
      return
    }

    complianceApi
      .getComplianceChecks(selectedJobId ?? undefined)
      .then(setChecks)
      .catch((error) => setErrorMessage(normalizeApiError(error, 'Failed to load compliance checks').message))
      .finally(() => setChecksLoading(false))
  }, [complianceApi, view, selectedJobId])

  useEffect(() => {
    if (view !== 'billing') {
      return
    }

    let isCancelled = false

    const loadBilling = async () => {
      setBillingSummaryError(null)
      setBillingInvoicesError(null)

      try {
        const summary = await billingApi.getSubscriptionSummary()
        if (!isCancelled) {
          setBillingSummary(summary)
        }
      } catch {
        if (!isCancelled) {
          setBillingSummary(null)
          setBillingSummaryError('Unable to load subscription summary. Try again shortly.')
        }
      } finally {
        if (!isCancelled) {
          setIsBillingSummaryLoading(false)
        }
      }

      try {
        const response = await billingApi.getInvoices()
        if (!isCancelled) {
          setBillingInvoices(response.invoices)
        }
      } catch {
        if (!isCancelled) {
          setBillingInvoices([])
          setBillingInvoicesError('Unable to load invoices right now. Try again shortly.')
        }
      } finally {
        if (!isCancelled) {
          setIsBillingInvoicesLoading(false)
        }
      }
    }

    void loadBilling()

    return () => {
      isCancelled = true
    }
  }, [billingApi, view])

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null
  const visibleSteps = selectedJobId ? steps : []

  const openJobsView = () => {
    setView('jobs')
  }

  const openLaunchpadView = () => {
    setView('launchpad')
  }

  const openPricingView = () => {
    setView('pricing')
  }

  const openBillingView = () => {
    setIsBillingSummaryLoading(true)
    setIsBillingInvoicesLoading(true)
    setView('billing')
  }

  const openComplianceView = () => {
    setChecksLoading(true)
    setView('compliance')
  }

  const openSettingsView = () => {
    setDevicesLoading(true)
    setPasskeysLoading(true)
    setView('settings')
  }

  const handleApprove = async (stepId: string) => {
    const updated = await jobsApi.approveStep(stepId)
    setSteps((current) => current.map((step) => (step.id === updated.id ? updated : step)))
  }

  const handleDeny = async (stepId: string) => {
    const updated = await jobsApi.denyStep(stepId)
    setSteps((current) => current.map((step) => (step.id === updated.id ? updated : step)))
  }

  const handleCheckout = async (planCode: PlanCode) => {
    if (planCode === 'ENTERPRISE' || !isBillingConfigured) {
      return
    }

    try {
      await billingApi.createCheckoutSession(planCode, billingInterval)
    } catch {
      setBillingSummaryError('Unable to start checkout right now. Try again shortly.')
    }
  }

  const handleManageBilling = async () => {
    if (!isBillingConfigured) {
      return
    }

    try {
      await billingApi.createBillingPortalSession()
    } catch {
      setBillingSummaryError('Unable to open billing management right now. Try again shortly.')
    }
  }

  const handleEnrollPasskey = async () => {
    try {
      await authApi.startPasskeyEnrollment()
      await authApi.completePasskeyEnrollment('mock-browser-response')
      const refreshed = await authApi.listPasskeys()
      setPasskeys(refreshed)
    } catch (error) {
      setErrorMessage(normalizeApiError(error, 'Passkey enrollment failed').message)
    }
  }

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

  const handleRevokeDevice = async (deviceId: string) => {
    try {
      const updated = await authApi.revokeDevice(deviceId)
      setDevices((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (error) {
      setErrorMessage(normalizeApiError(error, 'Failed to revoke device').message)
    }
  }

  const handleExportEvidence = async (jobId: string) => {
    try {
      await complianceApi.exportEvidencePackage(jobId)
    } catch (error) {
      setErrorMessage(normalizeApiError(error, 'Failed to export evidence package').message)
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
          <div className="top-bar-meta">
            {session?.user?.isSuperAdmin ? <span>SUPER ADMIN</span> : null}
            {session?.user?.authProvider ? <span>{session.user.authProvider.toUpperCase()}</span> : null}
            <span>BILLING AND EXECUTION CONTROLS</span>
            <button
              type="button"
              className="primary-button"
              disabled={!createJobDecision.allowed}
              title={createJobDecision.reason ?? undefined}
            >
              New Job
            </button>
          </div>
        </header>

        <aside className="left-sidebar panel" aria-label="Main navigation">
          <button type="button" className={`nav-item ${view === 'jobs' ? 'nav-item-active' : ''}`} onClick={openJobsView}>
            <span className="nav-icon" />
            Jobs
          </button>
          <button type="button" className={`nav-item ${view === 'launchpad' ? 'nav-item-active' : ''}`} onClick={openLaunchpadView}>
            <span className="nav-icon" style={{ background: view === 'launchpad' ? '#ed4c4c' : undefined }} />
            Launchpad
          </button>
          <button type="button" className={`nav-item ${view === 'pricing' ? 'nav-item-active' : ''}`} onClick={openPricingView}>
            <span className="nav-icon" />
            Pricing
          </button>
          <button type="button" className={`nav-item ${view === 'billing' ? 'nav-item-active' : ''}`} onClick={openBillingView}>
            <span className="nav-icon" />
            Billing
          </button>
          <button type="button" className={`nav-item ${view === 'compliance' ? 'nav-item-active' : ''}`} onClick={openComplianceView}>
            <span className="nav-icon" />
            Compliance
          </button>
          <button type="button" className={`nav-item ${view === 'settings' ? 'nav-item-active' : ''}`} onClick={openSettingsView}>
            <span className="nav-icon" />
            Settings
          </button>
        </aside>

        <section className="center-column">
          {(createJobDecision.warning || dangerousApprovalDecision.warning || evidenceExportDecision.warning) && (
            <section className="panel usage-warning" aria-label="Usage warning">
              <p className="warning-text">Usage Warning</p>
              <p>{createJobDecision.warning ?? dangerousApprovalDecision.warning ?? evidenceExportDecision.warning}</p>
            </section>
          )}

          {errorMessage && (
            <section className="panel">
              <p className="billing-error">{errorMessage}</p>
            </section>
          )}

          {view === 'jobs' && (
            <>
              <JobsListScreen
                jobs={jobs}
                activeFilter={activeFilter}
                activeJobId={selectedJobId}
                onFilterChange={setActiveFilter}
                onSelectJob={setSelectedJobId}
              />

              <section className="details-column">
                <header className="panel selected-job-header">
                  <h2>{selectedJob?.title ?? 'Select a job'}</h2>
                  <p className="muted">{selectedJob?.metadata ?? 'No active session selected.'}</p>
                </header>
                <JobDetailStream
                  steps={visibleSteps}
                  onApprove={handleApprove}
                  onDeny={handleDeny}
                  approvalDisabledReason={dangerousApprovalDecision.allowed ? null : dangerousApprovalDecision.reason}
                />
              </section>
            </>
          )}

          {view === 'launchpad' && (
            <AudioRealtimeView
              messages={audioMessages}
              isPlaying={isAudioPlaying}
              currentTimeMs={audioCurrentTime}
              totalDurationMs={DEMO_TOTAL_DURATION_MS}
              onTogglePlay={handleAudioTogglePlay}
              onSeek={handleAudioSeek}
              onGenerate={handleAudioGenerate}
              onMicToggle={handleAudioMicToggle}
              onStop={handleAudioStop}
              isMicActive={isMicActive}
              isGenerating={isGenerating}
            />
          )}

          {view === 'pricing' && (
            <PricingPage
              plans={plans}
              interval={billingInterval}
              onIntervalChange={setBillingInterval}
              onCheckout={handleCheckout}
              isBillingConfigured={isBillingConfigured}
              missingStripeVars={missingStripeVars}
            />
          )}

          {view === 'billing' && (
            <BillingDashboard
              summary={billingSummary}
              invoices={billingInvoices}
              isSummaryLoading={isBillingSummaryLoading}
              isInvoicesLoading={isBillingInvoicesLoading}
              summaryError={billingSummaryError}
              invoicesError={billingInvoicesError}
              isBillingConfigured={isBillingConfigured}
              onManage={handleManageBilling}
              onUpgrade={openPricingView}
            />
          )}

          {view === 'compliance' && (
            <ComplianceEvidencePanel
              checks={checks}
              loading={checksLoading}
              error={null}
              exportDisabledReason={evidenceExportDecision.allowed ? null : evidenceExportDecision.reason}
              onExportEvidence={handleExportEvidence}
            />
          )}

          {view === 'settings' && (
            <RoleGuard
              role={session?.user?.role ?? null}
              allowedRoles={['owner', 'cto', 'developer']}
              fallback={
                <section className="panel">
                  <p className="muted">Security settings are limited to elevated roles.</p>
                </section>
              }
            >
              <SecuritySettings
                passkeys={passkeys}
                devices={devices}
                onEnrollPasskey={handleEnrollPasskey}
                onRevokeDevice={handleRevokeDevice}
                passkeysLoading={passkeysLoading}
                devicesLoading={devicesLoading}
                errorMessage={null}
              />
            </RoleGuard>
          )}
        </section>

        {view === 'launchpad' ? (
          <AudioConfigPanel config={audioConfig} onConfigChange={setAudioConfig} />
        ) : (
          <aside className="right-config panel" aria-label="Config panel">
            <h3>Billing Config</h3>
            <p className="muted">Stripe environment status</p>
            <p>{isBillingConfigured ? 'Configured' : `${missingStripeVars.length} vars missing`}</p>
            {!isBillingConfigured && <p className="muted">Billing actions run in safe stub mode until Stripe config is complete.</p>}
            <ul className="env-list">
              {missingStripeVars.slice(0, 4).map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          </aside>
        )}
      </main>
    </RouteGuard>
  )
}

export default App
