import { useState, useRef, useEffect, useCallback, useMemo } from 'react'

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
  isPlaying: boolean
  currentTimeMs: number
  totalDurationMs: number
  onTogglePlay: () => void
  onSeek: (ms: number) => void
  onGenerate: () => void
  onMicToggle: () => void
  onStop: () => void
  isMicActive: boolean
  isGenerating: boolean
}

export function AudioRealtimeView({
  messages,
  isPlaying,
  currentTimeMs,
  totalDurationMs,
  onTogglePlay,
  onSeek,
  onGenerate,
  onMicToggle,
  onStop,
  isMicActive,
  isGenerating,
}: AudioRealtimeViewProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [hoveredTime, setHoveredTime] = useState<number | null>(null)

  // Pre-generate stable waveform bar heights using a seeded pattern
  const waveformHeights = useMemo(() => {
    const heights: number[] = []
    for (let i = 0; i < 120; i++) {
      // Deterministic pseudo-random pattern based on index
      const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453
      const normalized = seed - Math.floor(seed)
      heights.push(normalized * 0.7 + 0.3)
    }
    return heights
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, currentTimeMs])

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  const progress = totalDurationMs > 0 ? (currentTimeMs / totalDurationMs) * 100 : 0

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || totalDurationMs === 0) return
      const rect = timelineRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = Math.max(0, Math.min(1, x / rect.width))
      onSeek(ratio * totalDurationMs)
    },
    [totalDurationMs, onSeek],
  )

  const handleTimelineHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || totalDurationMs === 0) return
      const rect = timelineRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = Math.max(0, Math.min(1, x / rect.width))
      setHoveredTime(ratio * totalDurationMs)
    },
    [totalDurationMs],
  )

  const isMessageActive = (msg: AudioMessage) =>
    currentTimeMs >= msg.startMs && currentTimeMs <= msg.endMs

  const isMessagePast = (msg: AudioMessage) => currentTimeMs > msg.endMs

  return (
    <div className="audio-view">
      {/* Conversation timeline */}
      <div className="audio-conversation">
        <div className="audio-conversation-header">
          <span className="audio-session-label">Realtime Session</span>
          <span className="audio-session-meta">
            {messages.length} messages
            <span className="audio-dot-separator" />
            {formatTime(totalDurationMs)} total
          </span>
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
              <p className="audio-empty-title">Start a realtime session</p>
              <p className="audio-empty-desc">
                Click Generate or use the microphone to begin an audio conversation.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`audio-message ${isMessageActive(msg) ? 'audio-message-active' : ''} ${isMessagePast(msg) ? 'audio-message-past' : 'audio-message-future'}`}
            >
              <div className="audio-message-time">{msg.timestamp}</div>
              <div className="audio-message-body">
                <div className={`audio-message-role audio-role-${msg.role.toLowerCase()}`}>
                  {msg.role}
                </div>
                <div className="audio-message-text">{msg.text}</div>
              </div>
              {isMessageActive(msg) && (
                <div className="audio-message-indicator">
                  <span className="audio-active-dot" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom playback bar */}
      <div className="audio-playback-bar">
        <div className="audio-playback-controls">
          <button
            type="button"
            className="audio-control-btn audio-play-btn"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="2" width="4" height="12" rx="1" />
                <rect x="9" y="2" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2.5v11l9-5.5L4 2.5z" />
              </svg>
            )}
          </button>

          <span className="audio-time-display">
            {formatTime(currentTimeMs)} / {formatTime(totalDurationMs)}
          </span>
        </div>

        {/* Waveform timeline */}
        <div
          className="audio-timeline-track"
          ref={timelineRef}
          onClick={handleTimelineClick}
          onMouseMove={handleTimelineHover}
          onMouseLeave={() => setHoveredTime(null)}
          role="slider"
          aria-label="Audio timeline"
          aria-valuemin={0}
          aria-valuemax={totalDurationMs}
          aria-valuenow={currentTimeMs}
          tabIndex={0}
        >
          {/* Waveform visualization */}
          <div className="audio-waveform">
            {waveformHeights.map((height, i) => {
              const barProgress = (i / 120) * 100
              const isPast = barProgress <= progress
              return (
                <div
                  key={i}
                  className={`audio-waveform-bar ${isPast ? 'audio-waveform-bar-past' : ''}`}
                  style={{ height: `${height * 100}%` }}
                />
              )
            })}
          </div>

          {/* Progress overlay */}
          <div className="audio-timeline-progress" style={{ width: `${progress}%` }} />

          {/* Playhead */}
          <div className="audio-playhead" style={{ left: `${progress}%` }} />

          {/* Hover tooltip */}
          {hoveredTime !== null && (
            <div
              className="audio-hover-tooltip"
              style={{
                left: `${(hoveredTime / totalDurationMs) * 100}%`,
              }}
            >
              {formatTime(hoveredTime)}
            </div>
          )}

          {/* Message region markers */}
          {messages.map((msg) => {
            const startPct = (msg.startMs / totalDurationMs) * 100
            const widthPct = ((msg.endMs - msg.startMs) / totalDurationMs) * 100
            return (
              <div
                key={`region-${msg.id}`}
                className={`audio-region-marker audio-region-${msg.role.toLowerCase()}`}
                style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                title={`${msg.role}: ${msg.text.slice(0, 40)}...`}
              />
            )
          })}
        </div>

        <div className="audio-playback-actions">
          <button
            type="button"
            className={`audio-action-btn audio-generate-btn ${isGenerating ? 'audio-btn-active' : ''}`}
            onClick={onGenerate}
          >
            Generate
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

          <button
            type="button"
            className="audio-action-btn audio-stop-btn"
            onClick={onStop}
            title="End session"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M2.5 1.5l9 5-9 5v-10z" transform="rotate(180 7 7)" />
              <rect x="1" y="3" width="3" height="8" rx="0.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
