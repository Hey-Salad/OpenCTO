import type { Step } from '../../types/opencto'
import { HumanApprovalCard } from '../approval/HumanApprovalCard'
import { SessionEndedDivider } from './SessionEndedDivider'
import { StreamMessageItem } from './StreamMessageItem'

interface JobDetailStreamProps {
  steps: Step[]
  onApprove: (stepId: string) => void
  onDeny: (stepId: string) => void
  approvalDisabledReason?: string | null
}

export function JobDetailStream({
  steps,
  onApprove,
  onDeny,
  approvalDisabledReason = null,
}: JobDetailStreamProps) {
  return (
    <section className="panel stream-panel">
      <header className="stream-header">
        <h2>Activity Stream</h2>
        {steps.length > 0 && (
          <span className="stream-step-count">{steps.length} steps</span>
        )}
      </header>

      {steps.length === 0 ? (
        <div className="stream-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M9 12h6M9 16h6M9 8h6M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p>Select a job to view its activity stream.</p>
        </div>
      ) : (
        <div className="stream-container">
          {steps.map((step) => {
            if (step.kind === 'SESSION_ENDED') {
              return <SessionEndedDivider key={step.id} timestamp={step.timestamp} />
            }
            if (step.kind === 'APPROVAL_REQUIRED') {
              return (
                <HumanApprovalCard
                  key={step.id}
                  step={step}
                  onViewDiff={() => undefined}
                  onDeny={onDeny}
                  onApprove={onApprove}
                  approvalDisabledReason={approvalDisabledReason}
                />
              )
            }
            return <StreamMessageItem key={step.id} step={step} />
          })}
        </div>
      )}
    </section>
  )
}
