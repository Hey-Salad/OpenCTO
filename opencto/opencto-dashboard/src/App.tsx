import { useEffect, useMemo, useState } from 'react'
import type { Job, Step } from './types/opencto'
import type { AuthSession, PasskeyCredential, TrustedDevice } from './types/auth'
import type { ComplianceCheck } from './types/compliance'
import type { EntitlementContext } from './types/billing'
import { JobsListScreen, type JobFilter } from './components/jobs/JobsListScreen'
import { JobDetailStream } from './components/stream/JobDetailStream'
import { MockOpenCtoAdapter } from './mocks/openctoMockAdapter'
import { AuthMockAdapter } from './mocks/authMockAdapter'
import { ComplianceMockAdapter } from './mocks/complianceMockAdapter'
import { normalizeApiError } from './lib/safeError'
import { evaluateEntitlement } from './utils/entitlements'
import { RouteGuard } from './components/auth/RouteGuard'
import { RoleGuard } from './components/auth/RoleGuard'
import { SecuritySettings } from './components/settings/SecuritySettings'
import { ComplianceEvidencePanel } from './components/compliance/ComplianceEvidencePanel'
import './index.css'

type AppView = 'jobs' | 'compliance' | 'settings'

function App() {
  const jobsApi = useMemo(() => new MockOpenCtoAdapter(), [])
  const authApi = useMemo(() => new AuthMockAdapter(), [])
  const complianceApi = useMemo(() => new ComplianceMockAdapter(), [])

  const [jobs, setJobs] = useState<Job[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [activeFilter, setActiveFilter] = useState<JobFilter>('ALL')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<AppView>('jobs')

  const [session, setSession] = useState<AuthSession | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [devices, setDevices] = useState<TrustedDevice[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([])
  const [passkeysLoading, setPasskeysLoading] = useState(false)

  const [checks, setChecks] = useState<ComplianceCheck[]>([])
  const [checksLoading, setChecksLoading] = useState(false)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const entitlementContext: EntitlementContext = {
    planCode: 'DEVELOPER',
    usage: {
      jobsUsed: 44,
      jobsLimit: 50,
      workersUsed: 2,
      workersLimit: 2,
      usersUsed: 1,
      usersLimit: 1,
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
        const safeError = normalizeApiError(error, 'Failed to load session')
        setErrorMessage(safeError.message)
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
    if (!selectedJobId) {
      return
    }

    jobsApi.listSteps(selectedJobId).then(setSteps)
  }, [jobsApi, selectedJobId])

  useEffect(() => {
    if (currentView !== 'settings') {
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
  }, [authApi, currentView])

  useEffect(() => {
    if (currentView !== 'compliance') {
      return
    }

    complianceApi
      .getComplianceChecks(selectedJobId ?? undefined)
      .then(setChecks)
      .catch((error) => setErrorMessage(normalizeApiError(error, 'Failed to load compliance checks').message))
      .finally(() => setChecksLoading(false))
  }, [complianceApi, currentView, selectedJobId])

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null
  const visibleSteps = selectedJobId ? steps : []

  const openJobsView = () => {
    setCurrentView('jobs')
  }

  const openComplianceView = () => {
    setChecksLoading(true)
    setCurrentView('compliance')
  }

  const openSettingsView = () => {
    setDevicesLoading(true)
    setPasskeysLoading(true)
    setCurrentView('settings')
  }

  const handleApprove = async (stepId: string) => {
    const updated = await jobsApi.approveStep(stepId)
    setSteps((current) => current.map((step) => (step.id === updated.id ? updated : step)))
  }

  const handleDeny = async (stepId: string) => {
    const updated = await jobsApi.denyStep(stepId)
    setSteps((current) => current.map((step) => (step.id === updated.id ? updated : step)))
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
            <span>JOB OPERATIONS</span>
            <button type="button" className="primary-button" disabled={!createJobDecision.allowed} title={createJobDecision.reason ?? undefined}>
              New Job
            </button>
          </div>
        </header>

        <aside className="left-sidebar panel" aria-label="Main navigation">
          <button type="button" className={`nav-item ${currentView === 'jobs' ? 'nav-item-active' : ''}`} onClick={openJobsView}>
            <span className="nav-icon" />
            Jobs
          </button>
          <button type="button" className={`nav-item ${currentView === 'compliance' ? 'nav-item-active' : ''}`} onClick={openComplianceView}>
            <span className="nav-icon" />
            Compliance
          </button>
          <button type="button" className={`nav-item ${currentView === 'settings' ? 'nav-item-active' : ''}`} onClick={openSettingsView}>
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

          {currentView === 'jobs' && (
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

          {currentView === 'compliance' && (
            <ComplianceEvidencePanel
              checks={checks}
              loading={checksLoading}
              error={null}
              exportDisabledReason={evidenceExportDecision.allowed ? null : evidenceExportDecision.reason}
              onExportEvidence={handleExportEvidence}
            />
          )}

          {currentView === 'settings' && (
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
          <h3>Config</h3>
          <label className="config-control">
            <span>Auto-scroll stream</span>
            <input type="checkbox" defaultChecked />
          </label>
          <label className="config-control">
            <span>Show compliance notes</span>
            <input type="checkbox" defaultChecked />
          </label>
          <label className="config-control">
            <span>Compact rows</span>
            <input type="checkbox" />
          </label>
        </aside>
      </main>
    </RouteGuard>
  )
}

export default App
