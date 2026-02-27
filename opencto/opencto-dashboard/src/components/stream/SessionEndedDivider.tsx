interface SessionEndedDividerProps {
  timestamp: string
}

export function SessionEndedDivider({ timestamp }: SessionEndedDividerProps) {
  return (
    <div className="session-divider" role="separator">
      <span>Session Ended</span>
      <time>{new Date(timestamp).toLocaleTimeString()}</time>
    </div>
  )
}
