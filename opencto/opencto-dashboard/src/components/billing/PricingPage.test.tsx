import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { PricingPage } from './PricingPage'
import { plans } from '../../mocks/billingMockAdapter'
import type { BillingInterval } from '../../types/billing'

function PricingHarness({ isBillingConfigured = true }: { isBillingConfigured?: boolean }) {
  const [interval, setInterval] = useState<BillingInterval>('MONTHLY')

  return (
    <PricingPage
      plans={plans}
      interval={interval}
      onIntervalChange={setInterval}
      onCheckout={vi.fn()}
      isBillingConfigured={isBillingConfigured}
      missingStripeVars={isBillingConfigured ? [] : ['VITE_STRIPE_PUBLISHABLE_KEY', 'VITE_STRIPE_PRICE_TEAM']}
    />
  )
}

test('toggles monthly/yearly pricing state on interval switch', () => {
  render(<PricingHarness />)

  // Team card starts monthly.
  expect(screen.getByText('$99')).toBeInTheDocument()
  expect(screen.getAllByText('per month').length).toBeGreaterThan(0)

  fireEvent.click(screen.getByText('Yearly'))

  expect(screen.getByText('$990')).toBeInTheDocument()
  expect(screen.getAllByText('per year').length).toBeGreaterThan(0)
})

test('renders Team as recommended', () => {
  render(<PricingHarness />)

  const teamHeading = screen.getByRole('heading', { name: 'Team' })
  expect(teamHeading).toBeInTheDocument()
  expect(screen.getByText('Recommended')).toBeInTheDocument()
})

test('shows non-breaking fallback UI and disables checkout when Stripe config is missing', () => {
  render(<PricingHarness isBillingConfigured={false} />)

  expect(screen.getByRole('alert')).toHaveTextContent('Stripe checkout is not configured')

  const planButtons = screen.getAllByRole('button', { name: 'Start Plan' })
  expect(planButtons.length).toBeGreaterThan(0)
  for (const button of planButtons) {
    expect(button).toBeDisabled()
  }

  expect(screen.getByRole('button', { name: 'Contact Sales' })).toBeEnabled()
})
