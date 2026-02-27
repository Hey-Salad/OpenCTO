import { useEffect, useMemo, useState } from 'react'
import type { Job, Step } from './types/opencto'
import type { AuthSession, PasskeyCredential, TrustedDevice } from './types/auth'
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
import { MockOpenCtoAdapter } from './mocks/openctoMockAdapter'
import { BillingMockAdapter, plans } from './mocks/billingMockAdapter'
import { AuthMockAdapter } from './mocks/authMockAdapter'
import { ComplianceMockAdapter } from './mocks/complianceMockAdapter'
import { getStripeMissingEnvVars } from './config/stripe'
import { normalizeApiError } from './lib/safeError'
import { evaluateEntitlement } from './utils/entitlements'
import { RouteGuard } from './components/auth/RouteGuard'
import { RoleGuard } from './components/auth/RoleGuard'
import { SecuritySettings } from './components/settings/SecuritySettings'
import { ComplianceEvidencePanel } from './components/compliance/ComplianceEvidencePanel'
import './index.css'

type AppView = 'jobs' | 'pricing' | 'billing' | 'compliance' | 'settings'

function App() {
  const jobsApi = useMemo(() => new MockOpenCtoAdapter(), [])
  const billingApi = useMemo(() => new BillingMockAdapter(), [])
  const authApi = useMemo(() => new AuthMockAdapter(), [])
  const complianceApi = useMemo(() => new ComplianceMockAdapter(), [])

  const [view, setView] = useState<AppView>('jobs')

  const [jobs, setJobs] = useState<Job[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [activeFilter, setActiveFilter] = useState<JobFilter>('ALL')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const [session, setSession] = useState<AuthSession | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
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
          <section className="panel">
            <h2>Authentication Required</h2>
            <p className="muted">Sign in with a trusted device to access OpenCTO.</p>
          </section>
        </main>
      }
    >
      <main className="app-shell">
        <header className="top-bar panel">
          <h1>OpenCTO</h1>
          <div className="top-bar-meta">
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
      </main>
    </RouteGuard>
  )
}

export default App
