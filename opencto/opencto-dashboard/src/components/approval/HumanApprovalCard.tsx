import type { Step } from '../../types/opencto'

interface HumanApprovalCardProps {
  step: Step
  onViewDiff: (stepId: string) => void
  onApprove: (stepId: string) => void
  onDeny: (stepId: string) => void
  approvalDisabledReason?: string | null
}

export function HumanApprovalCard({
  step,
  onViewDiff,
  onApprove,
  onDeny,
  approvalDisabledReason = null,
}: HumanApprovalCardProps) {
  return (
    <article className="approval-card approval-dangerous" aria-label="Human approval required">
      <div className="approval-header">
        <p className="role-label">Human Approval Required</p>
        <p className="warning-text">DANGEROUS ACTION</p>
      </div>

      <dl className="approval-grid">
        <div>
          <dt>Tool</dt>
          <dd>{step.toolName ?? 'Unknown tool'}</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd>{step.compliance?.riskClass ?? 'DANGEROUS'}</dd>
        </div>
        <div>
          <dt>Branch</dt>
          <dd>{step.branchName ?? 'N/A'}</dd>
        </div>
      </dl>

      <section className="compliance-zone">
        <p className="muted">Compliance status</p>
        <p className={`compliance-badge compliance-${(step.compliance?.status ?? 'WARN').toLowerCase()}`}>
          {step.compliance?.status ?? 'WARN'}
        </p>
        <p>{step.compliance?.summary ?? 'Manual approval is required.'}</p>
      </section>

      {approvalDisabledReason && <p className="muted">{approvalDisabledReason}</p>}

      <div className="approval-actions">
        <button type="button" className="secondary-button" onClick={() => onViewDiff(step.id)}>
          View Diff
        </button>
        <button
          type="button"
          className="ghost-danger-button"
          onClick={() => onDeny(step.id)}
          disabled={Boolean(approvalDisabledReason)}
        >
          Deny
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => onApprove(step.id)}
          disabled={Boolean(approvalDisabledReason)}
        >
          Approve
        </button>
      </div>
    </article>
  )
}
