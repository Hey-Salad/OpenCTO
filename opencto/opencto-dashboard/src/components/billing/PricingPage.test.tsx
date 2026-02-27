import { fireEvent, render, screen } from '@testing-library/react'
import { PricingPage } from './PricingPage'
import { plans } from '../../mocks/billingMockAdapter'

test('renders plans and interval toggle', () => {
  const onIntervalChange = vi.fn()
  const onCheckout = vi.fn()

  render(
    <PricingPage plans={plans} interval="MONTHLY" onIntervalChange={onIntervalChange} onCheckout={onCheckout} />,
  )

  expect(screen.getByText('Pricing')).toBeInTheDocument()
  expect(screen.getByText('Team')).toBeInTheDocument()
  expect(screen.getByText('Recommended')).toBeInTheDocument()

  fireEvent.click(screen.getByText('Yearly'))
  expect(onIntervalChange).toHaveBeenCalledWith('YEARLY')

  fireEvent.click(screen.getAllByText('Start Plan')[0])
  expect(onCheckout).toHaveBeenCalled()
})
