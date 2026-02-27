import {
  toSubscriptionStatusLabel,
  toSubscriptionStatusTone,
  type BillingSummaryResponse,
  type Invoice,
} from '../../types/billing'

interface BillingDashboardProps {
  summary: BillingSummaryResponse | null
  invoices: Invoice[]
  isSummaryLoading: boolean
  isInvoicesLoading: boolean
  summaryError: string | null
  invoicesError: string | null
  isBillingConfigured: boolean
  onUpgrade: () => void
  onManage: () => void
}

function usageValue(used: number, limit: number | null, suffix = ''): string {
  if (limit === null) {
    return `${used}${suffix} / Unlimited`
  }

  return `${used}${suffix} / ${limit}${suffix}`
}

function getInvoiceActionLabel(invoice: Invoice): string {
  if (invoice.pdfUrl) {
    return `Download ${invoice.number}`
  }

  if (invoice.hostedInvoiceUrl) {
    return `View ${invoice.number}`
  }

  return 'Pending'
}

function getInvoiceActionHref(invoice: Invoice): string | null {
  return invoice.pdfUrl ?? invoice.hostedInvoiceUrl ?? null
}

export function BillingDashboard({
  summary,
  invoices,
  isSummaryLoading,
  isInvoicesLoading,
  summaryError,
  invoicesError,
  isBillingConfigured,
  onUpgrade,
  onManage,
}: BillingDashboardProps) {
  const tone = toSubscriptionStatusTone(summary?.subscription.status)
  const statusLabel = toSubscriptionStatusLabel(summary?.subscription.status)
  const actionsDisabled = !isBillingConfigured || isSummaryLoading

  return (
    <section className="panel billing-page">
      <header className="billing-header">
        <div>
          <h2>Billing Dashboard</h2>
          <p className="muted">Subscription status, usage, and invoices.</p>
        </div>
        <div className="billing-actions">
          <button type="button" className="secondary-button" disabled={actionsDisabled} onClick={onManage}>
            Manage Billing
          </button>
          <button type="button" className="primary-button" disabled={actionsDisabled} onClick={onUpgrade}>
            Upgrade Plan
          </button>
        </div>
      </header>

      {!isBillingConfigured && (
        <div className="billing-warning" role="alert">
          Stripe billing portal is not configured. Manage and checkout actions are disabled until configuration is complete.
        </div>
      )}

      {summaryError && (
        <div className="billing-error" role="alert">
          {summaryError}
        </div>
      )}

      <section className="current-plan-card">
        <div>
          <p className="muted">Current Plan</p>
          <h3>{summary?.currentPlan.name ?? (isSummaryLoading ? 'Loading...' : 'Starter')}</h3>
        </div>
        <span className={`status-badge status-${tone}`}>{statusLabel}</span>
      </section>

      <section className="usage-grid" aria-label="Usage summary">
        <article className="usage-item">
          <p className="muted">Jobs</p>
          <p>{usageValue(summary?.usage.jobsUsed ?? 0, summary?.usage.jobsLimit ?? null)}</p>
        </article>
        <article className="usage-item">
          <p className="muted">Workers</p>
          <p>{usageValue(summary?.usage.workersUsed ?? 0, summary?.usage.workersLimit ?? null)}</p>
        </article>
        <article className="usage-item">
          <p className="muted">Users</p>
          <p>{usageValue(summary?.usage.usersUsed ?? 0, summary?.usage.usersLimit ?? null)}</p>
        </article>
        <article className="usage-item">
          <p className="muted">Codex Credit / Spend</p>
          <p>{usageValue(summary?.usage.codexCreditUsedUsd ?? 0, summary?.usage.codexCreditLimitUsd ?? null, ' USD')}</p>
        </article>
      </section>

      <section className="invoices-panel" aria-label="Invoices">
        <h3>Invoices</h3>

        {isInvoicesLoading && (
          <div className="invoice-skeleton" role="status" aria-label="Loading invoices">
            <div className="invoice-skeleton-row" />
            <div className="invoice-skeleton-row" />
            <div className="invoice-skeleton-row" />
          </div>
        )}

        {!isInvoicesLoading && invoicesError && (
          <div className="billing-error" role="alert">
            {invoicesError}
          </div>
        )}

        {!isInvoicesLoading && !invoicesError && invoices.length === 0 && (
          <p className="muted" role="status">
            No invoices are available yet.
          </p>
        )}

        {!isInvoicesLoading && !invoicesError && invoices.length > 0 && (
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Download / Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const actionHref = getInvoiceActionHref(invoice)
                return (
                  <tr key={invoice.id}>
                    <td>{new Date(invoice.createdAt).toLocaleDateString()}</td>
                    <td>${invoice.amountPaidUsd.toFixed(2)}</td>
                    <td>{invoice.status}</td>
                    <td>
                      {actionHref ? (
                        <a className="invoice-action-link" href={actionHref} target="_blank" rel="noreferrer">
                          {getInvoiceActionLabel(invoice)}
                        </a>
                      ) : (
                        <span className="muted">{getInvoiceActionLabel(invoice)}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </section>
  )
}
