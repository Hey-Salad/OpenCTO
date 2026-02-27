import { fireEvent, render, screen } from '@testing-library/react'
import { ComplianceEvidencePanel } from './ComplianceEvidencePanel'
import type { ComplianceCheck } from '../../types/compliance'

const checks: ComplianceCheck[] = [
  {
    id: 'chk-1',
    jobId: 'job-1',
    checkType: 'PLAN',
    status: 'PASS',
    score: 0.95,
    findings: [],
    checkedAt: '2026-02-27T00:00:00.000Z',
  },
  {
    id: 'chk-2',
    jobId: 'job-2',
    checkType: 'DEPLOYMENT',
    status: 'BLOCK',
    score: 0.33,
    findings: [],
    checkedAt: '2026-02-27T00:00:00.000Z',
  },
]

test('renders compliance statuses and export button', () => {
  const onExportEvidence = vi.fn()
  render(
    <ComplianceEvidencePanel
      checks={checks}
      loading={false}
      error={null}
      exportDisabledReason={null}
      onExportEvidence={onExportEvidence}
    />,
  )

  expect(screen.getByText('PASS')).toBeInTheDocument()
  expect(screen.getByText('BLOCK')).toBeInTheDocument()

  fireEvent.click(screen.getAllByText('Export Evidence')[0])
  expect(onExportEvidence).toHaveBeenCalledWith('job-1')
})
