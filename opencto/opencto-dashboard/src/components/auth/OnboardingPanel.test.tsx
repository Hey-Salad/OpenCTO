import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OnboardingPanel } from './OnboardingPanel'

describe('OnboardingPanel', () => {
  it('disables continue when required fields are missing', () => {
    render(
      <OnboardingPanel
        initialState={null}
        onSubmit={vi.fn()}
      />, 
    )

    expect(screen.getByRole('button', { name: 'Continue to Workspace' })).toBeDisabled()
  })

  it('shows terms text in onboarding', () => {
    render(
      <OnboardingPanel
        initialState={null}
        onSubmit={vi.fn(async () => undefined)}
      />,
    )
    expect(screen.getByText(/Terms and Conditions/i)).toBeInTheDocument()
  })
})
