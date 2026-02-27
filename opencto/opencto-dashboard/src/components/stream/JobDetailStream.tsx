import type { Step } from '../../types/opencto'
import { HumanApprovalCard } from '../approval/HumanApprovalCard'
import { SessionEndedDivider } from './SessionEndedDivider'
import { StreamMessageItem } from './StreamMessageItem'

interface JobDetailStreamProps {
  steps: Step[]
  onApprove: (stepId: string) => void
  onDeny: (stepId: string) => void
}

export function JobDetailStream({ steps, onApprove, onDeny }: JobDetailStreamProps) {
  return (
    <section className="panel">
      <header className="stream-header">
        <h2>Job Stream</h2>
      </header>

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
              />
            )
          }

          return <StreamMessageItem key={step.id} step={step} />
        })}
      </div>
    </section>
  )
}
