import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { AudioConfig } from './AudioConfigPanel'
import { CTOAgentSession, type AgentEvent } from '../../lib/ctoAgent'
import { isGeminiLiveModel, isOpenAIRealtimeModel } from '../../lib/realtime/shared'

export interface AudioMessage {
  id: string
  role: 'USER' | 'ASSISTANT' | 'TOOL'
  text: string
  timestamp: string
  startMs: number
  endMs: number
}

interface AudioRealtimeViewProps {
  messages: AudioMessage[]
  onAddMessage: (msg: AudioMessage) => void
  audioConfig: AudioConfig
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error'

const TOKEN_URL = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/realtime/token`

function isVoiceModel(model: string): boolean {
  return isOpenAIRealtimeModel(model) || isGeminiLiveModel(model)
}

// Human-readable tool names for the UI
function formatToolName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function AudioRealtimeView({ messages, onAddMessage, audioConfig }: AudioRealtimeViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const clientRef = useRef<CTOAgentSession | null>(null)

  const [isSessionActive, setIsSessionActive] = useState(false)
  const [sessionElapsedMs, setSessionElapsedMs] = useState(0)
  const [isTextInputOpen, setIsTextInputOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const [isMicActive, setIsMicActive] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  // Track in-progress tool calls so we can update their row when done
  const activeToolIds = useRef<Map<string, string>>(new Map())

  const waveformHeights = useMemo(() => {
    return Array.from({ length: 120 }, (_, i) => {
      const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453
      const normalized = seed - Math.floor(seed)
      return normalized * 0.7 + 0.3
    })
  }, [])

  useEffect(() => {
    if (!isSessionActive) return
    const interval = setInterval(() => { setSessionElapsedMs((p) => p + 1000) }, 1000)
    return () => clearInterval(interval)
  }, [isSessionActive])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    if (isTextInputOpen) textInputRef.current?.focus()
  }, [isTextInputOpen])

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  const progress = sessionElapsedMs > 0
    ? Math.min(100, (sessionElapsedMs / Math.max(sessionElapsedMs, 60000)) * 100)
    : 0
  const isVoiceMode = isVoiceModel(audioConfig.voiceModel)

  // ---------------------------------------------------------------------------
  // Agent event handler
  // ---------------------------------------------------------------------------

  const handleAgentEvent = useCallback((event: AgentEvent) => {
    const now = Date.now()
    const ts = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    switch (event.type) {
      case 'session_started':
        setConnectionState('connected')
        setIsSessionActive(true)
        break
      case 'session_ended':
        setConnectionState('idle')
        setIsSessionActive(false)
        setIsMicActive(false)
        setIsTextInputOpen(false)
        clientRef.current = null
        break
      case 'user_transcript':
        onAddMessage({ id: `msg-${now}-u`, role: 'USER', text: event.text, timestamp: ts, startMs: now, endMs: now })
        break
      case 'assistant_transcript_done':
        onAddMessage({ id: `msg-${now}-a`, role: 'ASSISTANT', text: event.text, timestamp: ts, startMs: now, endMs: now })
        break
      case 'tool_start': {
        const id = `tool-${now}-${event.toolName}`
        activeToolIds.current.set(event.toolName, id)
        onAddMessage({
          id,
          role: 'TOOL',
          text: `Calling ${formatToolName(event.toolName)}…`,
          timestamp: ts,
          startMs: now,
          endMs: now,
        })
        break
      }
      case 'tool_end': {
        // Swap the "Calling…" row for a "Done" row using the same id so it replaces in place.
        const id = activeToolIds.current.get(event.toolName) ?? `tool-done-${now}-${event.toolName}`
        activeToolIds.current.delete(event.toolName)
        onAddMessage({
          id,
          role: 'TOOL',
          text: `${formatToolName(event.toolName)} done`,
          timestamp: ts,
          startMs: now,
          endMs: now,
        })
        break
      }
      case 'error':
        setConnectionError(event.message)
        setConnectionState('error')
        break
    }
  }, [onAddMessage])

  // ---------------------------------------------------------------------------
  // Session / mic handlers
  // ---------------------------------------------------------------------------

  const handleStartSession = async () => {
    setConnectionError(null)

    if (!audioConfig.voiceModel?.trim()) {
      setConnectionError('Select a Voice model before starting a session.')
      return
    }

    setConnectionState('connecting')
    setSessionElapsedMs(0)

    const client = new CTOAgentSession(TOKEN_URL, {
      model: audioConfig.voiceModel,
      reasoningModel: audioConfig.reasoningModel,
      instructions: audioConfig.systemInstructions,
      voice: audioConfig.voice,
      turnDetection: audioConfig.turnDetection,
      threshold: audioConfig.threshold,
      prefixPadding: audioConfig.prefixPadding,
      silenceDuration: audioConfig.silenceDuration,
      transcriptModel: audioConfig.transcriptModel,
      maxTokens: audioConfig.maxTokens,
    }, handleAgentEvent)
    clientRef.current = client

    try {
      await client.connect()
      if (isVoiceMode) {
        try {
          await client.startMicrophone()
          setIsMicActive(true)
        } catch (micError) {
          const micMsg = micError instanceof Error ? micError.message : 'Microphone access failed'
          setConnectionError(micMsg)
          setIsMicActive(false)
        }
      } else {
        setIsTextInputOpen(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      setConnectionError(msg)
      setConnectionState('error')
      clientRef.current = null
    }
  }

  const handleEndSession = () => {
    clientRef.current?.disconnect()
    clientRef.current = null
    setIsSessionActive(false)
    setIsMicActive(false)
    setIsTextInputOpen(false)
    setInputText('')
    setConnectionState('idle')
    setConnectionError(null)
    activeToolIds.current.clear()
  }

  const handleMicToggle = async () => {
    const client = clientRef.current
    if (!client) return
    if (!isVoiceMode) {
      setConnectionError('Microphone is only available for Voice (Realtime) models. Use text input for this model.')
      return
    }
    if (isMicActive) {
      client.stopMicrophone()
      setIsMicActive(false)
    } else {
      try {
        await client.startMicrophone()
        setIsMicActive(true)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Microphone access failed'
        setConnectionError(msg)
      }
    }
  }

  const handleSend = () => {
    const trimmed = inputText.trim()
    if (!trimmed) return
    const now = Date.now()
    onAddMessage({
      id: `msg-${now}-text`,
      role: 'USER',
      text: trimmed,
      timestamp: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      startMs: now,
      endMs: now,
    })
    clientRef.current?.sendText(trimmed)
    setInputText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      setIsTextInputOpen(false)
      setInputText('')
    }
  }

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
          {messages.length === 0 && !connectionError && (
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
                  <polyline points="33,52 44,61 33,70" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="42,57 53,65 42,73" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="audio-empty-title">
                {isSessionActive ? 'Listening...' : 'Start a session to begin'}
              </p>
              <p className="audio-empty-desc">
                {isSessionActive
                  ? 'Speak or type — your conversation will appear here.'
                  : 'Select Voice + Reasoning models in the panel, then press play.'}
              </p>
            </div>
          )}

          {connectionError && (
            <div className="audio-empty-state">
              <p className="audio-empty-title audio-error-title">Connection error</p>
              <p className="audio-empty-desc">{connectionError}</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`audio-message audio-message-past ${msg.role === 'TOOL' ? 'audio-message-tool' : ''}`}>
              <div className="audio-message-time">{msg.timestamp}</div>
              <div className="audio-message-body">
                <div className={`audio-message-role audio-role-${msg.role.toLowerCase()}`}>
                  {msg.role === 'TOOL' ? 'TOOL' : msg.role}
                </div>
                <div className="audio-message-text">{msg.text}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Text input row */}
      {isSessionActive && isTextInputOpen && (
        <div className="audio-text-input-row">
          <input
            ref={textInputRef}
            type="text"
            className="audio-text-input"
            placeholder="Type a message…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="audio-send-btn"
            onClick={handleSend}
            disabled={!inputText.trim()}
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      )}

      {/* Bottom bar */}
      <div className="audio-playback-bar">
        {!isSessionActive ? (
          <button
            type="button"
            className="audio-start-session-btn"
            onClick={() => { void handleStartSession() }}
            disabled={connectionState === 'connecting'}
            aria-label={connectionState === 'connecting' ? 'Connecting…' : 'Start session'}
          >
            {connectionState === 'connecting' ? (
              <span className="audio-spinner" aria-hidden="true" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        ) : (
          <>
            <div className="audio-playback-controls">
              <span className="audio-time-display">
                {formatTime(sessionElapsedMs)} · LIVE
              </span>
            </div>

            <div className="audio-timeline-track">
              <div className="audio-waveform">
                {waveformHeights.map((height, i) => {
                  const isPast = (i / 120) * 100 <= progress
                  return (
                    <div
                      key={i}
                      className={`audio-waveform-bar ${isPast ? 'audio-waveform-bar-past' : ''}`}
                      style={{ height: `${height * 100}%` }}
                    />
                  )
                })}
              </div>
              <div className="audio-timeline-progress" style={{ width: `${progress}%` }} />
              <div className="audio-playhead" style={{ left: `${progress}%` }} />
            </div>

            <div className="audio-playback-actions">
              <button
                type="button"
                className={`audio-action-btn audio-keyboard-btn ${isTextInputOpen ? 'audio-keyboard-active' : ''}`}
                onClick={() => setIsTextInputOpen((prev) => !prev)}
                title={isTextInputOpen ? 'Close text input' : 'Open text input'}
                aria-pressed={isTextInputOpen}
              >
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
                onClick={() => { void handleMicToggle() }}
                title={
                  !isVoiceMode
                    ? 'Microphone is disabled for Text/Code/Reasoning models'
                    : isMicActive
                      ? 'Mute microphone'
                      : 'Unmute microphone'
                }
                disabled={!isVoiceMode}
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
                className="audio-end-btn"
                onClick={handleEndSession}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                  <rect width="10" height="10" rx="2" />
                </svg>
                End Session
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
