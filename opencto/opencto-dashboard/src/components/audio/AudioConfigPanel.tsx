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
  { value: 'sage', label: 'Sage' },
  { value: 'ember', label: 'Ember' },
  { value: 'alloy', label: 'Alloy' },
  { value: 'coral', label: 'Coral' },
  { value: 'vale', label: 'Vale' },
]

const MODEL_OPTIONS = [
  { value: 'opencto-realtime-v1', label: 'opencto-realtime-v1' },
  { value: 'opencto-realtime-preview', label: 'opencto-realtime-preview' },
  { value: 'cheri-ml-1.3b-rt', label: 'cheri-ml-1.3b-rt' },
]

const TRANSCRIPT_MODEL_OPTIONS = [
  { value: 'cheri-ml-transcribe', label: 'cheri-ml-transcribe' },
  { value: 'whisper-large-v3', label: 'whisper-large-v3' },
  { value: 'opencto-stt-v1', label: 'opencto-stt-v1' },
]

export function AudioConfigPanel({ config, onConfigChange }: AudioConfigPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    instructions: true,
    voice: true,
    detection: true,
    model: true,
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
          <span className="audio-config-count">2</span>
        </div>
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
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="audio-config-sub-label">User transcript model</div>
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

      {/* Advanced / Model Configuration */}
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
