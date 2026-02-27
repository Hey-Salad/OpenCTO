import type { Step } from '../../types/opencto'

interface StreamMessageItemProps {
  step: Step
}

export function StreamMessageItem({ step }: StreamMessageItemProps) {
  return (
    <article className="stream-item">
      <header>
        <p className="role-label">{step.role}</p>
        <time>{new Date(step.timestamp).toLocaleTimeString()}</time>
      </header>
      <p>{step.message}</p>
    </article>
  )
}
