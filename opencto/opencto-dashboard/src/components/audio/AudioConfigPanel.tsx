import { useState } from 'react'

export interface AudioConfig {
  systemInstructions: string
  voice: string
  turnDetection: boolean
  threshold: number
  prefixPadding: number
  silenceDuration: number
  idleTimeout: boolean
  model: string
  transcriptModel: string
  noiseReduction: boolean
  maxTokens: number
}

interface AudioConfigPanelProps {
  config: AudioConfig
  onConfigChange: (config: AudioConfig) => void
}

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy' },
  { value: 'ash', label: 'Ash' },
  { value: 'ballad', label: 'Ballad' },
  { value: 'coral', label: 'Coral' },
  { value: 'echo', label: 'Echo' },
  { value: 'sage', label: 'Sage' },
  { value: 'shimmer', label: 'Shimmer' },
  { value: 'verse', label: 'Verse' },
]

const MODEL_GROUPS = [
  {
    label: 'OpenAI',
    models: [
      { value: 'gpt-4o-realtime-preview', label: 'GPT-4o Realtime' },
      { value: 'gpt-4o-mini-realtime-preview', label: 'GPT-4o Mini Realtime' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      { value: 'o3', label: 'o3' },
      { value: 'o4-mini', label: 'o4 Mini' },
    ],
  },
  {
    label: 'Anthropic',
    models: [
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
  },
  {
    label: 'Google',
    models: [
      { value: 'gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro Preview' },
      { value: 'gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash Preview' },
      { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Exp' },
      { value: 'gemini-live-2.0-flash-exp', label: 'Gemini Live 2.0 Flash' },
    ],
  },
  {
    label: 'Qwen',
    models: [
      { value: 'qwen2.5-omni-7b', label: 'Qwen2.5 Omni 7B' },
      { value: 'qwen2.5-72b-instruct', label: 'Qwen2.5 72B Instruct' },
      { value: 'qwen2-audio-7b-instruct', label: 'Qwen2 Audio 7B' },
      { value: 'qwq-32b', label: 'QwQ 32B' },
    ],
  },
  {
    label: 'Meta',
    models: [
      { value: 'meta-llama/llama-4-scout', label: 'Llama 4 Scout' },
      { value: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick' },
      { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    ],
  },
  {
    label: 'Mistral',
    models: [
      { value: 'mistral-large-latest', label: 'Mistral Large' },
      { value: 'mistral-small-latest', label: 'Mistral Small' },
      { value: 'codestral-latest', label: 'Codestral' },
    ],
  },
  {
    label: 'DeepSeek',
    models: [
      { value: 'deepseek-chat', label: 'DeepSeek V3' },
      { value: 'deepseek-reasoner', label: 'DeepSeek R1' },
    ],
  },
  {
    label: 'HeySalad',
    models: [
      { value: 'opencto-realtime-v1', label: 'OpenCTO Realtime v1' },
      { value: 'cheri-ml-1.3b-rt', label: 'Cheri ML 1.3B RT' },
    ],
  },
]

const TRANSCRIPT_MODEL_OPTIONS = [
  { value: 'whisper-1', label: 'Whisper 1' },
  { value: 'whisper-large-v3', label: 'Whisper Large v3' },
  { value: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe' },
  { value: 'gpt-4o-mini-transcribe', label: 'GPT-4o Mini Transcribe' },
  { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
  { value: 'cheri-ml-transcribe', label: 'Cheri ML Transcribe' },
]

export function AudioConfigPanel({ config, onConfigChange }: AudioConfigPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    instructions: true,
    model: true,
    voice: true,
    detection: false,
    advanced: false,
  })

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const update = <K extends keyof AudioConfig>(key: K, value: AudioConfig[K]) => {
    onConfigChange({ ...config, [key]: value })
  }

  return (
    <aside className="audio-config-panel panel" aria-label="Audio configuration">
      {/* System Instructions */}
      <div className="audio-config-section">
        <button
          type="button"
          className="audio-config-section-header"
          onClick={() => toggleSection('instructions')}
        >
          <span className="audio-config-section-title">System instructions</span>
          <span className={`audio-config-chevron ${expandedSections.instructions ? 'open' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </button>
        {expandedSections.instructions && (
          <div className="audio-config-section-body">
            <textarea
              className="audio-config-textarea"
              placeholder="Enter system instructions for the AI agent..."
              value={config.systemInstructions}
              onChange={(e) => update('systemInstructions', e.target.value)}
              rows={4}
            />
          </div>
        )}
      </div>

      {/* Model */}
      <div className="audio-config-section">
        <button
          type="button"
          className="audio-config-section-header"
          onClick={() => toggleSection('model')}
        >
          <span className="audio-config-section-title">Model</span>
          <span className={`audio-config-chevron ${expandedSections.model ? 'open' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </button>
        {expandedSections.model && (
          <div className="audio-config-section-body">
            <select
              className="audio-config-select"
              value={config.model}
              onChange={(e) => update('model', e.target.value)}
            >
              {MODEL_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.models.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <div className="audio-config-sub-label">Transcript model</div>
            <select
              className="audio-config-select"
              value={config.transcriptModel}
              onChange={(e) => update('transcriptModel', e.target.value)}
            >
              {TRANSCRIPT_MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="audio-config-toggle-row">
              <span className="audio-config-label">Noise reduction</span>
              <button
                type="button"
                className={`audio-toggle ${config.noiseReduction ? 'audio-toggle-on' : 'audio-toggle-off'}`}
                onClick={() => update('noiseReduction', !config.noiseReduction)}
                aria-label="Toggle noise reduction"
              />
            </div>
          </div>
        )}
      </div>

      {/* Voice */}
      <div className="audio-config-section">
        <button
          type="button"
          className="audio-config-section-header"
          onClick={() => toggleSection('voice')}
        >
          <span className="audio-config-section-title">Voice</span>
          <span className={`audio-config-chevron ${expandedSections.voice ? 'open' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </button>
        {expandedSections.voice && (
          <div className="audio-config-section-body">
            <select
              className="audio-config-select"
              value={config.voice}
              onChange={(e) => update('voice', e.target.value)}
            >
              {VOICE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Turn Detection */}
      <div className="audio-config-section">
        <button
          type="button"
          className="audio-config-section-header"
          onClick={() => toggleSection('detection')}
        >
          <span className="audio-config-section-title">Turn detection</span>
          <span className={`audio-config-chevron ${expandedSections.detection ? 'open' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </button>
        {expandedSections.detection && (
          <div className="audio-config-section-body">
            <div className="audio-config-toggle-row">
              <span className="audio-config-label">Automatic turn detection</span>
              <button
                type="button"
                className={`audio-toggle ${config.turnDetection ? 'audio-toggle-on' : 'audio-toggle-off'}`}
                onClick={() => update('turnDetection', !config.turnDetection)}
                aria-label="Toggle automatic turn detection"
              />
            </div>

            <div className="audio-config-slider-group">
              <div className="audio-config-slider-header">
                <span className="audio-config-label">Threshold</span>
                <span className="audio-config-value">{config.threshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                className="audio-config-slider"
                min="0"
                max="1"
                step="0.01"
                value={config.threshold}
                onChange={(e) => update('threshold', parseFloat(e.target.value))}
              />
            </div>

            <div className="audio-config-slider-group">
              <div className="audio-config-slider-header">
                <span className="audio-config-label">Prefix padding (ms)</span>
                <span className="audio-config-value">{config.prefixPadding}</span>
              </div>
              <input
                type="range"
                className="audio-config-slider"
                min="0"
                max="1000"
                step="10"
                value={config.prefixPadding}
                onChange={(e) => update('prefixPadding', parseInt(e.target.value))}
              />
            </div>

            <div className="audio-config-slider-group">
              <div className="audio-config-slider-header">
                <span className="audio-config-label">Silence duration (ms)</span>
                <span className="audio-config-value">{config.silenceDuration}</span>
              </div>
              <input
                type="range"
                className="audio-config-slider"
                min="100"
                max="2000"
                step="50"
                value={config.silenceDuration}
                onChange={(e) => update('silenceDuration', parseInt(e.target.value))}
              />
            </div>

            <div className="audio-config-toggle-row">
              <span className="audio-config-label">Idle timeout</span>
              <button
                type="button"
                className={`audio-toggle ${config.idleTimeout ? 'audio-toggle-on' : 'audio-toggle-off'}`}
                onClick={() => update('idleTimeout', !config.idleTimeout)}
                aria-label="Toggle idle timeout"
              />
            </div>
          </div>
        )}
      </div>

      {/* Functions */}
      <div className="audio-config-section">
        <div className="audio-config-section-header audio-config-section-static">
          <span className="audio-config-section-title">Functions</span>
          <span className="audio-config-count">0</span>
        </div>
      </div>

      {/* MCP Servers */}
      <div className="audio-config-section">
        <div className="audio-config-section-header audio-config-section-static">
          <span className="audio-config-section-title">MCP servers</span>
          <span className="audio-config-count">0</span>
        </div>
      </div>

      {/* Advanced */}
      <div className="audio-config-section">
        <button
          type="button"
          className="audio-config-section-header"
          onClick={() => toggleSection('advanced')}
        >
          <span className="audio-config-section-title">Model configuration</span>
          <span className={`audio-config-chevron ${expandedSections.advanced ? 'open' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </button>
        {expandedSections.advanced && (
          <div className="audio-config-section-body">
            <div className="audio-config-slider-group">
              <div className="audio-config-slider-header">
                <span className="audio-config-label">Max tokens</span>
                <span className="audio-config-value">{config.maxTokens}</span>
              </div>
              <input
                type="range"
                className="audio-config-slider"
                min="256"
                max="16384"
                step="256"
                value={config.maxTokens}
                onChange={(e) => update('maxTokens', parseInt(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
