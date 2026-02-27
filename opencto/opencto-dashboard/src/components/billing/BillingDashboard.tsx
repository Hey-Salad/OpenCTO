import type { BillingSummaryResponse, Invoice } from '../../types/billing'

interface BillingDashboardProps {
  summary: BillingSummaryResponse | null
  invoices: Invoice[]
  onUpgrade: () => void
  onManage: () => void
}

function usageValue(used: number, limit: number | null, suffix = ''): string {
  if (limit === null) {
    return `${used}${suffix} / Unlimited`
  }

  return `${used}${suffix} / ${limit}${suffix}`
}

export function BillingDashboard({ summary, invoices, onUpgrade, onManage }: BillingDashboardProps) {
  const status = summary?.subscription.status ?? 'trialing'

  return (
    <section className="panel billing-page">
      <header className="billing-header">
        <div>
          <h2>Billing Dashboard</h2>
          <p className="muted">Subscription status, usage, and invoices.</p>
        </div>
        <div className="billing-actions">
          <button type="button" className="secondary-button" onClick={onManage}>
            Manage Billing
          </button>
          <button type="button" className="primary-button" onClick={onUpgrade}>
            Upgrade Plan
          </button>
        </div>
      </header>

      <section className="current-plan-card">
        <div>
          <p className="muted">Current Plan</p>
          <h3>{summary?.currentPlan.name ?? 'Starter'}</h3>
        </div>
        <span className={`status-badge status-${status}`}>{status}</span>
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
          <p className="muted">Codex Credit</p>
          <p>{usageValue(summary?.usage.codexCreditUsedUsd ?? 0, summary?.usage.codexCreditLimitUsd ?? null, ' USD')}</p>
        </article>
      </section>

      <section className="invoices-panel" aria-label="Invoices">
        <h3>Invoices</h3>
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Status</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.number}</td>
                <td>{new Date(invoice.createdAt).toLocaleDateString()}</td>
                <td>{invoice.status}</td>
                <td>${invoice.amountPaidUsd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  )
}
