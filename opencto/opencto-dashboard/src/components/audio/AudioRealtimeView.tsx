import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import type { AudioConfig } from './AudioConfigPanel'
import { CTOAgentSession, type AgentEvent } from '../../lib/ctoAgent'
import { parseAssistantOutput } from '../../lib/realtime/assistantOutput'
import { isGeminiLiveModel, isOpenAIRealtimeModel } from '../../lib/realtime/shared'
import { getApiBaseUrl } from '../../config/apiBase'
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'

export interface AudioMessage {
  id: string
  role: 'USER' | 'ASSISTANT' | 'TOOL'
  kind?: 'speech' | 'code' | 'command' | 'output' | 'artifact' | 'plan'
  text: string
  timestamp: string
  startMs: number
  endMs: number
  metadata?: {
    language?: string
    command?: string
    exitCode?: number
    source?: string
    title?: string
  }
}

interface AudioRealtimeViewProps {
  messages: AudioMessage[]
  onAddMessage: (msg: AudioMessage) => void
  audioConfig: AudioConfig
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error'

const TOKEN_URL = `${getApiBaseUrl()}/api/v1/realtime/token`
const RUNS_BASE_URL = import.meta.env.VITE_AGENT_BASE_URL ?? 'https://cloud-services-api.opencto.works'

hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('json', json)

function isVoiceModel(model: string): boolean {
  return isOpenAIRealtimeModel(model) || isGeminiLiveModel(model)
}

// Human-readable tool names for the UI
function formatToolName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function mergeTranscriptFragment(current: string, incoming: string): string {
  const next = incoming.trim()
  if (!next) return current
  if (!current) return next
  if (next === current) return current
  if (next.startsWith(current)) return next
  if (current.startsWith(next)) return current
  if (current.endsWith(next)) return current
  return `${current} ${next}`.replace(/\s+/g, ' ').trim()
}

const TRANSCRIPT_DEBOUNCE_MS = 700
const TRANSCRIPT_MIN_WORDS = 3
const TRANSCRIPT_MAX_HOLD_MS = 2500

function transcriptWordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}

function looksLikeCompletedSentence(text: string): boolean {
  return /[.!?…:]$/.test(text.trim())
}

function formatConnectionError(message: string): string {
  const normalized = message.trim()
  if (!normalized) return 'Unable to start a realtime session. Check your model settings and try again.'

  const lower = normalized.toLowerCase()
  if (lower.includes('permission denied') || lower.includes('notallowederror')) {
    return 'Microphone permission was denied. Allow microphone access in your browser and try again.'
  }
  if (lower.includes('token request failed') || lower.includes('missing clientsecret')) {
    return 'Failed to initialize the OpenAI realtime session token. Verify backend auth/token configuration.'
  }
  if (lower.includes('google_api_key') || lower.includes('api key')) {
    return 'Google Live requires a valid API key. Set VITE_GOOGLE_API_KEY and retry.'
  }
  if (lower.includes('timed out') || lower.includes('websocket connection error')) {
    return 'Realtime connection timed out. Check network connectivity and model availability, then retry.'
  }
  if (lower.includes('closed before open')) {
    return 'Realtime connection closed during startup. Retry, and verify the selected model is available.'
  }
  return normalized
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null = tokenRegex.exec(text)
  while (match) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={`b-${match.index}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(<code key={`c-${match.index}`}>{token.slice(1, -1)}</code>)
    } else {
      nodes.push(token)
    }
    lastIndex = match.index + token.length
    match = tokenRegex.exec(text)
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

function highlightCode(code: string, language?: string): string {
  const lang = (language ?? '').toLowerCase()
  if (lang && hljs.getLanguage(lang)) {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
  }
  return hljs.highlightAuto(code).value
}

function renderMessageText(text: string): ReactNode {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const raw = lines[i].trim()
    if (!raw) {
      i += 1
      continue
    }

    if (raw.startsWith('- ') || raw.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length) {
        const line = lines[i].trim()
        if (!(line.startsWith('- ') || line.startsWith('* '))) break
        items.push(line.slice(2).trim())
        i += 1
      }
      blocks.push(
        <ul key={`ul-${i}`}>
          {items.map((item, idx) => (
            <li key={`li-${i}-${idx}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      )
      continue
    }

    blocks.push(<p key={`p-${i}`}>{renderInlineMarkdown(raw)}</p>)
    i += 1
  }
  return <>{blocks}</>
}

function renderMessageContent(msg: AudioMessage, onCopy: (text: string, key: string) => void, copiedKey: string | null): ReactNode {
  const kind = msg.kind ?? 'speech'
  if (kind === 'code') {
    const language = msg.metadata?.language ? msg.metadata.language : 'code'
    const copyKey = `${msg.id}-code`
    return (
      <div className="audio-code-card">
        <div className="audio-code-header">
          <button
            type="button"
            className="audio-copy-btn"
            onClick={() => onCopy(msg.text, copyKey)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="9" width="10" height="10" rx="2" />
              <rect x="5" y="5" width="10" height="10" rx="2" />
            </svg>
            {copiedKey === copyKey ? 'Copied' : 'Copy code'}
          </button>
          <span>{language}</span>
        </div>
        <pre>
          <code
            dangerouslySetInnerHTML={{ __html: highlightCode(msg.text, msg.metadata?.language) }}
          />
        </pre>
      </div>
    )
  }
  if (kind === 'command') {
    return (
      <div className="audio-command-card">
        <code>$ {msg.metadata?.command ?? msg.text}</code>
      </div>
    )
  }
  if (kind === 'output') {
    return (
      <pre className="audio-output-card">{msg.text}</pre>
    )
  }
  if (kind === 'plan') {
    return (
      <ol className="audio-plan-card">
        {msg.text.split('\n').map((item, idx) => (
          <li key={`${msg.id}-plan-${idx}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ol>
    )
  }
  if (kind === 'artifact') {
    return (
      <div className="audio-artifact-card">
        {msg.metadata?.title && <div className="audio-artifact-title">{msg.metadata.title}</div>}
        <div>{renderMessageText(msg.text)}</div>
      </div>
    )
  }
  return renderMessageText(msg.text)
}

function renderRoleLabel(role: AudioMessage['role']): ReactNode {
  if (role === 'ASSISTANT') {
    return (
      <span className="audio-role-opencto">
        <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <rect width="18" height="18" rx="4" fill="currentColor" />
          <path d="M4.2 13.8a4.8 4.8 0 1 1 9.6-4.2" stroke="#0b0b0d" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="4.2" cy="13.8" r="0.9" fill="#0b0b0d" />
          <circle cx="13.8" cy="9.6" r="0.9" fill="#0b0b0d" />
        </svg>
        <span>OpenCTO</span>
      </span>
    )
  }
  if (role === 'TOOL') return 'TOOL'
  return role
}

export function AudioRealtimeView({ messages, onAddMessage, audioConfig }: AudioRealtimeViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const clientRef = useRef<CTOAgentSession | null>(null)
  const pendingUserTranscriptRef = useRef('')
  const pendingAssistantTranscriptRef = useRef('')
  const userFlushTimerRef = useRef<number | null>(null)
  const assistantFlushTimerRef = useRef<number | null>(null)
  const userPendingSinceRef = useRef<number | null>(null)
  const assistantPendingSinceRef = useRef<number | null>(null)
  const runIdRef = useRef<string | null>(null)
  const runEventSourceRef = useRef<EventSource | null>(null)
  const manualEndRef = useRef(false)
  const activeSessionIdRef = useRef<string | null>(null)

  const [isSessionActive, setIsSessionActive] = useState(false)
  const [sessionElapsedMs, setSessionElapsedMs] = useState(0)
  const [isTextInputOpen, setIsTextInputOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const [isMicActive, setIsMicActive] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [activeRunStatus, setActiveRunStatus] = useState<string>('idle')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
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

  const clearTranscriptTimers = useCallback(() => {
    if (userFlushTimerRef.current !== null) {
      window.clearTimeout(userFlushTimerRef.current)
      userFlushTimerRef.current = null
    }
    if (assistantFlushTimerRef.current !== null) {
      window.clearTimeout(assistantFlushTimerRef.current)
      assistantFlushTimerRef.current = null
    }
  }, [])

  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1200)
    } catch {
      setCopiedKey(null)
    }
  }, [])

  const postRunStep = useCallback(async (type: 'plan' | 'tool_call' | 'artifact', status: 'running' | 'completed' | 'failed', title: string, details: Record<string, unknown>) => {
    const runId = runIdRef.current
    if (!runId) return
    try {
      await fetch(`${RUNS_BASE_URL}/v1/runs/${encodeURIComponent(runId)}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, status, title, details }),
      })
    } catch {
      // Non-blocking tracking
    }
  }, [])

  const postRunArtifact = useCallback(async (kind: 'code' | 'command' | 'output' | 'log', title: string, content: string, metadata: Record<string, unknown>) => {
    const runId = runIdRef.current
    if (!runId) return
    try {
      await fetch(`${RUNS_BASE_URL}/v1/runs/${encodeURIComponent(runId)}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, title, content, metadata }),
      })
    } catch {
      // Non-blocking tracking
    }
  }, [])

  const stopRunTracking = useCallback(async (finalStatus: 'complete' | 'fail', summary?: string) => {
    const runId = runIdRef.current
    if (!runId) return
    runEventSourceRef.current?.close()
    runEventSourceRef.current = null
    try {
      const path = finalStatus === 'complete' ? 'complete' : 'fail'
      await fetch(`${RUNS_BASE_URL}/v1/runs/${encodeURIComponent(runId)}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalStatus === 'complete' ? { summary } : { summary, error: connectionError ?? 'Session failed' }),
      })
    } catch {
      // Non-blocking tracking
    } finally {
      runIdRef.current = null
      setActiveRunId(null)
      setActiveRunStatus('idle')
    }
  }, [connectionError])

  const startRunTracking = useCallback(async () => {
    if (runIdRef.current) return
    try {
      const res = await fetch(`${RUNS_BASE_URL}/v1/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `launch-${Date.now()}`,
        },
        body: JSON.stringify({
          goal: audioConfig.systemInstructions || 'Realtime coding copilot session',
          voice_model: audioConfig.voiceModel,
          reasoning_model: audioConfig.reasoningModel,
        }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { run_id?: string; status?: string }
      if (!data.run_id) return
      runIdRef.current = data.run_id
      setActiveRunStatus(data.status ?? 'queued')
      setActiveRunId(data.run_id)
      void postRunStep('plan', 'running', 'Realtime session started', {
        voiceModel: audioConfig.voiceModel,
        reasoningModel: audioConfig.reasoningModel,
      })

      const source = new EventSource(`${RUNS_BASE_URL}/v1/runs/${encodeURIComponent(data.run_id)}/events`)
      runEventSourceRef.current = source
      source.addEventListener('update', (evt) => {
        const event = evt as MessageEvent<string>
        try {
          const payload = JSON.parse(event.data) as { type?: string; run?: { status?: string } }
          if (payload.type === 'run.updated' && payload.run?.status) {
            setActiveRunStatus(payload.run.status)
          }
        } catch {
          // Ignore malformed SSE data
        }
      })
      source.onerror = () => {
        source.close()
      }
    } catch {
      // Non-blocking tracking
    }
  }, [audioConfig.reasoningModel, audioConfig.systemInstructions, audioConfig.voiceModel, postRunStep])

  const flushTranscript = useCallback((role: 'USER' | 'ASSISTANT', force = false): boolean => {
    const now = Date.now()
    const timestamp = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const rawText = role === 'USER' ? pendingUserTranscriptRef.current : pendingAssistantTranscriptRef.current
    const text = rawText.trim()
    const trimmed = text.trim()
    if (!trimmed) return false

    const pendingSince = role === 'USER' ? userPendingSinceRef.current : assistantPendingSinceRef.current
    const holdMs = pendingSince ? now - pendingSince : 0
    const canEmit =
      force
      || transcriptWordCount(trimmed) >= TRANSCRIPT_MIN_WORDS
      || looksLikeCompletedSentence(trimmed)
      || holdMs >= TRANSCRIPT_MAX_HOLD_MS
    if (!canEmit) return false

    if (role === 'ASSISTANT') {
      const blocks = parseAssistantOutput(trimmed)
      blocks.forEach((block, idx) => {
        onAddMessage({
          id: `msg-${now}-a-${idx}`,
          role: 'ASSISTANT',
          kind: block.kind,
          text: block.text,
          metadata: block.metadata,
          timestamp,
          startMs: now,
          endMs: now,
        })
        if (block.kind === 'code') {
          void postRunArtifact('code', 'Generated code', block.text, { language: block.metadata?.language ?? '' })
        } else if (block.kind === 'command') {
          void postRunArtifact('command', 'Suggested command', block.text, { command: block.metadata?.command ?? '' })
        } else if (block.kind === 'output') {
          void postRunArtifact('output', 'Command output', block.text, {})
        } else if (block.kind === 'artifact' || block.kind === 'plan') {
          void postRunArtifact('log', block.metadata?.title ?? 'Assistant artifact', block.text, {})
        }
      })
    } else {
      onAddMessage({
        id: `msg-${now}-u`,
        role: 'USER',
        kind: 'speech',
        text: trimmed,
        timestamp,
        startMs: now,
        endMs: now,
      })
    }

    if (role === 'USER') {
      pendingUserTranscriptRef.current = ''
      userPendingSinceRef.current = null
    } else {
      pendingAssistantTranscriptRef.current = ''
      assistantPendingSinceRef.current = null
    }
    return true
  }, [onAddMessage, postRunArtifact])

  const scheduleTranscriptFlush = useCallback((role: 'USER' | 'ASSISTANT') => {
    const timerRef = role === 'USER' ? userFlushTimerRef : assistantFlushTimerRef
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const emitted = flushTranscript(role, false)
      timerRef.current = null
      if (!emitted) scheduleTranscriptFlush(role)
    }, TRANSCRIPT_DEBOUNCE_MS)
  }, [flushTranscript])

  const queueTranscript = useCallback((role: 'USER' | 'ASSISTANT', incomingText: string) => {
    const normalized = incomingText.trim()
    if (!normalized) return

    if (role === 'USER') {
      if (!pendingUserTranscriptRef.current) userPendingSinceRef.current = Date.now()
      pendingUserTranscriptRef.current = mergeTranscriptFragment(pendingUserTranscriptRef.current, normalized)
      scheduleTranscriptFlush('USER')
      return
    }

    if (!pendingAssistantTranscriptRef.current) assistantPendingSinceRef.current = Date.now()
    pendingAssistantTranscriptRef.current = mergeTranscriptFragment(pendingAssistantTranscriptRef.current, normalized)
    scheduleTranscriptFlush('ASSISTANT')
  }, [scheduleTranscriptFlush])

  useEffect(() => {
    return () => {
      clearTranscriptTimers()
    }
  }, [clearTranscriptTimers])

  // ---------------------------------------------------------------------------
  // Agent event handler
  // ---------------------------------------------------------------------------

  const handleAgentEvent = useCallback((event: AgentEvent) => {
    const now = Date.now()
    const ts = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    switch (event.type) {
      case 'session_started':
        setConnectionState('connected')
        setConnectionError(null)
        setIsSessionActive(true)
        void startRunTracking()
        break
      case 'session_ended':
        flushTranscript('USER', true)
        flushTranscript('ASSISTANT', true)
        clearTranscriptTimers()
        setConnectionState('idle')
        setIsSessionActive(false)
        setIsMicActive(false)
        setIsTextInputOpen(false)
        clientRef.current = null
        if (!manualEndRef.current && runIdRef.current) {
          void stopRunTracking(connectionState === 'error' ? 'fail' : 'complete', 'Realtime session ended')
        }
        manualEndRef.current = false
        break
      case 'user_transcript':
        queueTranscript('USER', event.text)
        break
      case 'assistant_transcript_done':
        queueTranscript('ASSISTANT', event.text)
        break
      case 'tool_start': {
        flushTranscript('USER', true)
        flushTranscript('ASSISTANT', true)
        void postRunStep('tool_call', 'running', `Calling ${formatToolName(event.toolName)}`, { toolName: event.toolName })
        const id = `tool-${now}-${event.toolName}`
        activeToolIds.current.set(event.toolName, id)
        onAddMessage({
          id,
          role: 'TOOL',
          kind: 'artifact',
          text: `Calling ${formatToolName(event.toolName)}…`,
          timestamp: ts,
          startMs: now,
          endMs: now,
        })
        break
      }
      case 'tool_end': {
        void postRunStep('tool_call', 'completed', `${formatToolName(event.toolName)} done`, { toolName: event.toolName })
        // Swap the "Calling…" row for a "Done" row using the same id so it replaces in place.
        const id = activeToolIds.current.get(event.toolName) ?? `tool-done-${now}-${event.toolName}`
        activeToolIds.current.delete(event.toolName)
        onAddMessage({
          id,
          role: 'TOOL',
          kind: 'artifact',
          text: `${formatToolName(event.toolName)} done`,
          timestamp: ts,
          startMs: now,
          endMs: now,
        })
        break
      }
      case 'error':
        flushTranscript('USER', true)
        flushTranscript('ASSISTANT', true)
        setConnectionError(formatConnectionError(event.message))
        setConnectionState('error')
        if (runIdRef.current) {
          void postRunStep('artifact', 'failed', 'Realtime error', { message: event.message })
        }
        break
    }
  }, [clearTranscriptTimers, connectionState, flushTranscript, onAddMessage, postRunStep, queueTranscript, startRunTracking, stopRunTracking])

  // ---------------------------------------------------------------------------
  // Session / mic handlers
  // ---------------------------------------------------------------------------

  const handleStartSession = async () => {
    if (connectionState === 'connecting' || isSessionActive) return

    manualEndRef.current = false
    setConnectionError(null)

    if (!audioConfig.voiceModel?.trim()) {
      setConnectionError('Select a Voice model before starting a session.')
      return
    }

    setConnectionState('connecting')
    setSessionElapsedMs(0)
    activeToolIds.current.clear()

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    activeSessionIdRef.current = sessionId
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
    }, (event) => {
      if (activeSessionIdRef.current !== sessionId) return
      handleAgentEvent(event)
    })
    clientRef.current = client

    try {
      await client.connect()
      if (isVoiceMode) {
        try {
          await client.startMicrophone()
          setIsMicActive(true)
        } catch (micError) {
          const micMsg = micError instanceof Error ? micError.message : 'Microphone access failed'
          setConnectionError(formatConnectionError(micMsg))
          setIsMicActive(false)
        }
      } else {
        setIsTextInputOpen(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      setConnectionError(formatConnectionError(msg))
      setConnectionState('error')
      if (activeSessionIdRef.current === sessionId) activeSessionIdRef.current = null
      client.disconnect()
      clientRef.current = null
    }
  }

  const handleEndSession = () => {
    manualEndRef.current = true
    activeSessionIdRef.current = null
    flushTranscript('USER', true)
    flushTranscript('ASSISTANT', true)
    clearTranscriptTimers()
    clientRef.current?.disconnect()
    if (runIdRef.current) void stopRunTracking('complete', 'Session ended by user')
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
    if (!client || !isSessionActive) return
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
        setConnectionError(formatConnectionError(msg))
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
      kind: 'speech',
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

  const handleCopyChat = useCallback(() => {
    const full = messages
      .map((msg) => {
        const role = msg.role
        const kind = msg.kind ? ` [${msg.kind}]` : ''
        return `${role}${kind}: ${msg.text}`
      })
      .join('\n\n')
    void handleCopy(full, 'full-chat')
  }, [handleCopy, messages])

  return (
    <div className="audio-view">
      {/* Conversation area */}
      <div className="audio-conversation">
        <div className="audio-conversation-header">
          <span className="audio-session-label">Realtime Session</span>
          <div className="audio-header-actions">
            {activeRunId ? (
              <span className="audio-session-meta">Run {activeRunId.slice(0, 16)}… · {activeRunStatus}</span>
            ) : messages.length > 0 ? (
              <span className="audio-session-meta">
                {messages.length} messages
              </span>
            ) : null}
            <button
              type="button"
              className="audio-copy-btn"
              onClick={handleCopyChat}
              disabled={messages.length === 0}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="9" y="9" width="10" height="10" rx="2" />
                <rect x="5" y="5" width="10" height="10" rx="2" />
              </svg>
              {copiedKey === 'full-chat' ? 'Copied' : 'Copy chat'}
            </button>
          </div>
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
                  {renderRoleLabel(msg.role)}
                </div>
                <div className="audio-message-text">{renderMessageContent(msg, handleCopy, copiedKey)}</div>
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
