import { fireEvent, render, screen } from '@testing-library/react'
import { JobRow } from './JobRow'
import type { Job } from '../../types/opencto'

const job: Job = {
  id: 'job-1',
  title: 'Sync governance docs',
  status: 'RUNNING',
  metadata: 'docs/governance | 2 steps',
  costUsd: 1.2,
  createdAt: '2026-02-27T00:00:00.000Z',
  updatedAt: '2026-02-27T00:00:00.000Z',
  compliance: {
    status: 'WARN',
    riskClass: 'ELEVATED',
    requiresHumanApproval: false,
    summary: 'Needs one update',
  },
}

test('renders metadata and triggers selection', () => {
  const onSelect = vi.fn()
  render(<JobRow job={job} active={false} onSelect={onSelect} />)

  expect(screen.getByText('Sync governance docs')).toBeInTheDocument()
  expect(screen.getByText('docs/governance')).toBeInTheDocument()
  expect(screen.getByText('2 steps')).toBeInTheDocument()
  expect(screen.getByText('WARN')).toBeInTheDocument()
  expect(screen.getByText('$1.20')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button'))
  expect(onSelect).toHaveBeenCalledWith('job-1')
})
