import { fireEvent, render, screen } from '@testing-library/react'
import { BillingDashboard } from './BillingDashboard'
import { BillingMockAdapter } from '../../mocks/billingMockAdapter'
import type { BillingSummaryResponse, SubscriptionStatus } from '../../types/billing'

async function buildSummary(status: SubscriptionStatus): Promise<BillingSummaryResponse> {
  const adapter = new BillingMockAdapter()
  const summary = await adapter.getSubscriptionSummary()
  return {
    ...summary,
    subscription: {
      ...summary.subscription,
      status,
    },
  }
}

test.each([
  ['trialing', 'trialing', 'status-trialing'],
  ['active', 'active', 'status-active'],
  ['past_due', 'past due', 'status-past_due'],
  ['canceled', 'canceled', 'status-canceled'],
  ['incomplete', 'Unknown', 'status-unknown'],
])('renders status badge safely for %s', async (rawStatus, expectedText, expectedClass) => {
  const summary = await buildSummary(rawStatus as SubscriptionStatus)

  render(
    <BillingDashboard
      summary={summary}
      invoices={[]}
      isSummaryLoading={false}
      isInvoicesLoading={false}
      summaryError={null}
      invoicesError={null}
      isBillingConfigured={true}
      onUpgrade={vi.fn()}
      onManage={vi.fn()}
    />,
  )

  const badge = screen.getByText(expectedText)
  expect(badge).toBeInTheDocument()
  expect(badge).toHaveClass(expectedClass)
})

test('renders invoices and action handlers when billing is configured', async () => {
  const adapter = new BillingMockAdapter()
  const summary = await adapter.getSubscriptionSummary()
  const invoices = (await adapter.getInvoices()).invoices
  const onUpgrade = vi.fn()
  const onManage = vi.fn()

  render(
    <BillingDashboard
      summary={summary}
      invoices={invoices}
      isSummaryLoading={false}
      isInvoicesLoading={false}
      summaryError={null}
      invoicesError={null}
      isBillingConfigured={true}
      onUpgrade={onUpgrade}
      onManage={onManage}
    />,
  )

  expect(screen.getByText('Download INV-2026-002')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Upgrade Plan' }))
  fireEvent.click(screen.getByRole('button', { name: 'Manage Billing' }))
  expect(onUpgrade).toHaveBeenCalledTimes(1)
  expect(onManage).toHaveBeenCalledTimes(1)
})

test('renders invoice loading, error, and empty states', async () => {
  const summary = await buildSummary('active')

  const { rerender } = render(
    <BillingDashboard
      summary={summary}
      invoices={[]}
      isSummaryLoading={false}
      isInvoicesLoading={true}
      summaryError={null}
      invoicesError={null}
      isBillingConfigured={true}
      onUpgrade={vi.fn()}
      onManage={vi.fn()}
    />,
  )

  expect(screen.getByRole('status', { name: 'Loading invoices' })).toBeInTheDocument()

  rerender(
    <BillingDashboard
      summary={summary}
      invoices={[]}
      isSummaryLoading={false}
      isInvoicesLoading={false}
      summaryError={null}
      invoicesError={'Unable to load invoices right now. Try again shortly.'}
      isBillingConfigured={true}
      onUpgrade={vi.fn()}
      onManage={vi.fn()}
    />,
  )

  expect(screen.getByRole('alert')).toHaveTextContent('Unable to load invoices right now. Try again shortly.')

  rerender(
    <BillingDashboard
      summary={summary}
      invoices={[]}
      isSummaryLoading={false}
      isInvoicesLoading={false}
      summaryError={null}
      invoicesError={null}
      isBillingConfigured={true}
      onUpgrade={vi.fn()}
      onManage={vi.fn()}
    />,
  )

  expect(screen.getByRole('status')).toHaveTextContent('No invoices are available yet.')
})

test('disables billing actions when Stripe config is missing', async () => {
  const summary = await buildSummary('active')

  render(
    <BillingDashboard
      summary={summary}
      invoices={[]}
      isSummaryLoading={false}
      isInvoicesLoading={false}
      summaryError={null}
      invoicesError={null}
      isBillingConfigured={false}
      onUpgrade={vi.fn()}
      onManage={vi.fn()}
    />,
  )

  expect(screen.getByRole('button', { name: 'Upgrade Plan' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Manage Billing' })).toBeDisabled()
  expect(screen.getByRole('alert')).toHaveTextContent('not configured')
})
