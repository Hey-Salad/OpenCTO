import { useState, useRef, useEffect } from 'react'

export interface AudioMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  text: string
  timestamp: string
  startMs: number
  endMs: number
}

interface AudioRealtimeViewProps {
  messages: AudioMessage[]
  onGenerate: () => void
  onMicToggle: () => void
  onStop: () => void
  isMicActive: boolean
  isGenerating: boolean
}

export function AudioRealtimeView({
  messages,
  onGenerate,
  onMicToggle,
  onStop,
  isMicActive,
  isGenerating,
}: AudioRealtimeViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isSessionActive, setIsSessionActive] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="audio-view">
      {/* Conversation area */}
      <div className="audio-conversation">
        <div className="audio-conversation-header">
          <span className="audio-session-label">Realtime Session</span>
          {messages.length > 0 && (
            <span className="audio-session-meta">
              {messages.length} messages
            </span>
          )}
        </div>

        <div className="audio-messages-scroll">
          {messages.length === 0 && (
            <div className="audio-empty-state">
              <div className="audio-empty-icon">
                <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
                  <rect width="100" height="100" rx="22" fill="#1a1a1a" />
                  <path
                    d="M 22,80 A 34 34 0 1 1 78,47"
                    stroke="#ed4c4c"
                    strokeWidth="8.5"
                    strokeLinecap="round"
                  />
                  <circle cx="22" cy="80" r="5" fill="#faa09a" />
                  <circle cx="78" cy="47" r="5" fill="#faa09a" />
                  <polyline
                    points="33,52 44,61 33,70"
                    stroke="white"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points="42,57 53,65 42,73"
                    stroke="white"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="audio-empty-title">
                {isSessionActive ? 'Listening...' : 'Start a session to begin'}
              </p>
              <p className="audio-empty-desc">
                {isSessionActive
                  ? 'Speak or type — your conversation will appear here.'
                  : 'Select a model in the panel, then hit Start Session.'}
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className="audio-message audio-message-past"
            >
              <div className="audio-message-time">{msg.timestamp}</div>
              <div className="audio-message-body">
                <div className={`audio-message-role audio-role-${msg.role.toLowerCase()}`}>
                  {msg.role}
                </div>
                <div className="audio-message-text">{msg.text}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="audio-playback-bar">
        {!isSessionActive ? (
          <button
            type="button"
            className="audio-start-session-btn"
            onClick={() => setIsSessionActive(true)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="9" y="2" width="5" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M3 4a6 6 0 0 1 0 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M6 5.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Start Session
          </button>
        ) : (
          <div className="audio-live-controls">
            <button
              type="button"
              className={`audio-action-btn audio-mic-btn ${isMicActive ? 'audio-mic-active' : ''}`}
              onClick={onMicToggle}
              title={isMicActive ? 'Mute microphone' : 'Unmute microphone'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="17" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            </button>

            <button type="button" className="audio-action-btn audio-keyboard-btn" title="Text input">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <line x1="6" y1="10" x2="6" y2="10" strokeLinecap="round" />
                <line x1="10" y1="10" x2="10" y2="10" strokeLinecap="round" />
                <line x1="14" y1="10" x2="14" y2="10" strokeLinecap="round" />
                <line x1="18" y1="10" x2="18" y2="10" strokeLinecap="round" />
                <line x1="8" y1="14" x2="16" y2="14" strokeLinecap="round" />
              </svg>
            </button>

            <button
              type="button"
              className={`audio-action-btn audio-generate-btn ${isGenerating ? 'audio-btn-active' : ''}`}
              onClick={onGenerate}
            >
              Generate
            </button>

            <button
              type="button"
              className="audio-action-btn audio-stop-btn"
              onClick={() => {
                onStop()
                setIsSessionActive(false)
              }}
              title="End session"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="1" y="1" width="10" height="10" rx="2" />
              </svg>
              End
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
