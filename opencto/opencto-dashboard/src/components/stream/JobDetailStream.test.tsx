import { render, screen } from '@testing-library/react'
import { JobDetailStream } from './JobDetailStream'
import type { Step } from '../../types/opencto'

const steps: Step[] = [
  {
    id: 'step-1',
    jobId: 'job',
    role: 'ORCHESTRATOR',
    message: 'Plan generated',
    timestamp: '2026-02-27T00:00:00.000Z',
    kind: 'MESSAGE',
  },
  {
    id: 'step-2',
    jobId: 'job',
    role: 'ASSISTANT',
    message: 'Session closed',
    timestamp: '2026-02-27T00:01:00.000Z',
    kind: 'SESSION_ENDED',
  },
]

test('renders role label and session divider', () => {
  render(<JobDetailStream steps={steps} onApprove={() => undefined} onDeny={() => undefined} />)

  expect(screen.getByText('ORCHESTRATOR')).toBeInTheDocument()
  expect(screen.getByText('Session Ended')).toBeInTheDocument()
})
