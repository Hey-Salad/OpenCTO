import { useEffect, useMemo, useState } from 'react'
import type { Job, Step } from './types/opencto'
import type { BillingInterval, BillingSummaryResponse, Invoice, PlanCode } from './types/billing'
import { JobsListScreen, type JobFilter } from './components/jobs/JobsListScreen'
import { JobDetailStream } from './components/stream/JobDetailStream'
import { PricingPage } from './components/billing/PricingPage'
import { BillingDashboard } from './components/billing/BillingDashboard'
import { MockOpenCtoAdapter } from './mocks/openctoMockAdapter'
import { BillingMockAdapter, plans } from './mocks/billingMockAdapter'
import { getStripeMissingEnvVars } from './config/stripe'
import './index.css'

type AppView = 'jobs' | 'pricing' | 'billing'

function App() {
  const jobsApi = useMemo(() => new MockOpenCtoAdapter(), [])
  const billingApi = useMemo(() => new BillingMockAdapter(), [])

  const [view, setView] = useState<AppView>('jobs')
  const [jobs, setJobs] = useState<Job[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [activeFilter, setActiveFilter] = useState<JobFilter>('ALL')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const [billingInterval, setBillingInterval] = useState<BillingInterval>('MONTHLY')
  const [billingSummary, setBillingSummary] = useState<BillingSummaryResponse | null>(null)
  const [billingInvoices, setBillingInvoices] = useState<Invoice[]>([])
  const [isBillingSummaryLoading, setIsBillingSummaryLoading] = useState(false)
  const [isBillingInvoicesLoading, setIsBillingInvoicesLoading] = useState(false)
  const [billingSummaryError, setBillingSummaryError] = useState<string | null>(null)
  const [billingInvoicesError, setBillingInvoicesError] = useState<string | null>(null)

  const missingStripeVars = getStripeMissingEnvVars()
  const isBillingConfigured = missingStripeVars.length === 0

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
    let isCancelled = false

    const loadBilling = async () => {
      setIsBillingSummaryLoading(true)
      setIsBillingInvoicesLoading(true)
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
  }, [billingApi])

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null
  const visibleSteps = selectedJobId ? steps : []

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

  return (
    <main className="app-shell">
      <header className="top-bar panel">
        <h1>OpenCTO</h1>
        <div className="top-bar-meta">
          <span>BILLING AND EXECUTION CONTROLS</span>
          <button type="button" className="primary-button">
            New Job
          </button>
        </div>
      </header>

      <aside className="left-sidebar panel" aria-label="Main navigation">
        <button type="button" className={`nav-item ${view === 'jobs' ? 'nav-item-active' : ''}`} onClick={() => setView('jobs')}>
          <span className="nav-icon" />
          Jobs
        </button>
        <button
          type="button"
          className={`nav-item ${view === 'pricing' ? 'nav-item-active' : ''}`}
          onClick={() => setView('pricing')}
        >
          <span className="nav-icon" />
          Pricing
        </button>
        <button
          type="button"
          className={`nav-item ${view === 'billing' ? 'nav-item-active' : ''}`}
          onClick={() => setView('billing')}
        >
          <span className="nav-icon" />
          Billing
        </button>
        <button type="button" className="nav-item" disabled>
          <span className="nav-icon" />
          Compliance
        </button>
        <button type="button" className="nav-item" disabled>
          <span className="nav-icon" />
          Metrics
        </button>
      </aside>

      <section className="center-column">
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
              <JobDetailStream steps={visibleSteps} onApprove={handleApprove} onDeny={handleDeny} />
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
            onUpgrade={() => setView('pricing')}
          />
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
  )
}

export default App
