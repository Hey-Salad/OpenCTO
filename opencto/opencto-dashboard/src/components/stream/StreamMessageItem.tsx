import type { Step } from '../../types/opencto'

interface StreamMessageItemProps {
  step: Step
}

export function StreamMessageItem({ step }: StreamMessageItemProps) {
  return (
    <article className="stream-item">
      <header className="stream-item-header">
        <span className={`stream-role-badge stream-role-${step.role.toLowerCase()}`}>
          {step.role}
        </span>
        <time className="stream-item-time">
          {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </header>
      <p className="stream-item-message">{step.message}</p>
    </article>
  )
}
