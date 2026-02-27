import { fireEvent, render, screen } from '@testing-library/react'
import { HumanApprovalCard } from './HumanApprovalCard'
import type { Step } from '../../types/opencto'

const approvalStep: Step = {
  id: 'step-9',
  jobId: 'job-2',
  role: 'WORKER',
  message: 'Deploy requested',
  timestamp: '2026-02-27T00:00:00.000Z',
  kind: 'APPROVAL_REQUIRED',
  toolName: 'kubectl apply',
  branchName: 'hotfix/critical',
  compliance: {
    status: 'BLOCK',
    riskClass: 'DANGEROUS',
    requiresHumanApproval: true,
    summary: 'Requires manual review',
  },
}

test('renders dangerous card and actions', () => {
  const onViewDiff = vi.fn()
  const onApprove = vi.fn()
  const onDeny = vi.fn()

  render(
    <HumanApprovalCard step={approvalStep} onViewDiff={onViewDiff} onApprove={onApprove} onDeny={onDeny} />,
  )

  expect(screen.getByText('DANGEROUS ACTION')).toBeInTheDocument()
  expect(screen.getByText('kubectl apply')).toBeInTheDocument()

  fireEvent.click(screen.getByText('View Diff'))
  fireEvent.click(screen.getByText('Approve'))
  fireEvent.click(screen.getByText('Deny'))

  expect(onViewDiff).toHaveBeenCalledWith('step-9')
  expect(onApprove).toHaveBeenCalledWith('step-9')
  expect(onDeny).toHaveBeenCalledWith('step-9')
})
