import { fireEvent, render, screen } from '@testing-library/react'
import { JobsListScreen } from './JobsListScreen'
import type { Job } from '../../types/opencto'

const jobs: Job[] = [
  {
    id: 'a',
    title: 'A',
    status: 'RUNNING',
    metadata: 'meta',
    costUsd: 1,
    createdAt: '2026-02-27T00:00:00.000Z',
    updatedAt: '2026-02-27T00:00:00.000Z',
    compliance: { status: 'PASS', riskClass: 'SAFE', requiresHumanApproval: false, summary: '' },
  },
  {
    id: 'b',
    title: 'B',
    status: 'FAILED',
    metadata: 'meta',
    costUsd: 2,
    createdAt: '2026-02-27T00:00:00.000Z',
    updatedAt: '2026-02-27T00:00:00.000Z',
    compliance: { status: 'BLOCK', riskClass: 'DANGEROUS', requiresHumanApproval: true, summary: '' },
  },
]

test('renders filter pills and list state', () => {
  const onFilterChange = vi.fn()
  render(
    <JobsListScreen
      jobs={jobs}
      activeFilter="ALL"
      activeJobId={null}
      onFilterChange={onFilterChange}
      onSelectJob={() => undefined}
    />,
  )

  expect(screen.getByText('New Job')).toBeInTheDocument()
  fireEvent.click(screen.getByText('Failed'))
  expect(onFilterChange).toHaveBeenCalledWith('FAILED')
  expect(screen.getByText('A')).toBeInTheDocument()
  expect(screen.getByText('B')).toBeInTheDocument()
})
