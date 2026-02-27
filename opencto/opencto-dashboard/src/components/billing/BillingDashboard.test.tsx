import { fireEvent, render, screen } from '@testing-library/react'
import { BillingDashboard } from './BillingDashboard'
import { BillingMockAdapter } from '../../mocks/billingMockAdapter'

test('renders summary and invoices', async () => {
  const adapter = new BillingMockAdapter()
  const summary = await adapter.fetchSubscriptionSummary()
  const invoices = (await adapter.fetchInvoices()).invoices
  const onUpgrade = vi.fn()
  const onManage = vi.fn()

  render(<BillingDashboard summary={summary} invoices={invoices} onUpgrade={onUpgrade} onManage={onManage} />)

  expect(screen.getByText('Billing Dashboard')).toBeInTheDocument()
  expect(screen.getByText('Invoices')).toBeInTheDocument()
  expect(screen.getByText('INV-2026-002')).toBeInTheDocument()

  fireEvent.click(screen.getByText('Upgrade Plan'))
  fireEvent.click(screen.getByText('Manage Billing'))
  expect(onUpgrade).toHaveBeenCalled()
  expect(onManage).toHaveBeenCalled()
})
