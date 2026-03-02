import { useEffect, useState } from 'react'
import { GOOGLE_LIVE_VOICE_MODELS, isGeminiLiveModel, selectSupportedGoogleLiveModel } from '../../lib/realtime/shared'

export interface AudioConfig {
  systemInstructions: string
  voice: string
  turnDetection: boolean
  threshold: number
  prefixPadding: number
  silenceDuration: number
  idleTimeout: boolean
  voiceModel: string
  reasoningModel: string
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

const VOICE_MODEL_GROUPS = [
  {
    label: 'Voice (Realtime) · OpenAI',
    models: [
      { value: 'gpt-4o-realtime-preview', label: 'GPT-4o Realtime' },
      { value: 'gpt-4o-mini-realtime-preview', label: 'GPT-4o Mini Realtime' },
      { value: 'gpt-realtime-1.5', label: 'GPT Realtime 1.5' },
    ],
  },
  {
    label: 'Voice (Realtime) · Google',
    models: GOOGLE_LIVE_VOICE_MODELS.map((value) => ({
      value,
      label: value === 'gemini-2.5-flash-native-audio-preview-12-2025'
        ? 'Gemini 2.5 Flash Native Audio (12-2025)'
        : 'Gemini 2.5 Flash Native Audio (09-2025)',
    })),
  },
]

const REASONING_MODEL_GROUPS = [
  {
    label: 'Reasoning Models · GitHub Models',
    models: [
      { value: 'github/ai21-labs/ai21-jamba-1.5-large', label: 'AI21 Jamba 1.5 Large' },
      { value: 'github/microsoft/phi-4-reasoning', label: 'Phi-4-reasoning' },
      { value: 'github/microsoft/phi-4-multimodal-instruct', label: 'Phi-4-multimodal-instruct' },
      { value: 'github/microsoft/phi-4-mini-reasoning', label: 'Phi-4-mini-reasoning' },
      { value: 'github/microsoft/phi-4-mini-instruct', label: 'Phi-4-mini-instruct' },
      { value: 'github/microsoft/phi-4', label: 'Phi-4' },
      { value: 'github/microsoft/mai-ds-r1', label: 'MAI-DS-R1' },
      { value: 'github/openai/gpt-4.1', label: 'GPT-4.1' },
      { value: 'github/openai/gpt-4.1-mini', label: 'GPT-4.1-mini' },
      { value: 'github/openai/gpt-4.1-nano', label: 'GPT-4.1-nano' },
      { value: 'github/openai/gpt-4o', label: 'GPT-4o' },
      { value: 'github/openai/gpt-4o-mini', label: 'GPT-4o mini' },
      { value: 'github/openai/gpt-5-preview', label: 'GPT-5 (preview)' },
      { value: 'github/openai/gpt-5-mini', label: 'GPT-5-mini' },
      { value: 'github/openai/gpt-5-nano', label: 'GPT-5-nano' },
      { value: 'github/openai/gpt-5-chat-preview', label: 'GPT-5-chat (preview)' },
      { value: 'github/openai/o1', label: 'o1' },
      { value: 'github/openai/o1-mini', label: 'o1-mini' },
      { value: 'github/openai/o1-preview', label: 'o1-preview' },
      { value: 'github/openai/o3', label: 'o3' },
      { value: 'github/openai/o3-mini', label: 'o3-mini' },
      { value: 'github/openai/o4-mini', label: 'o4-mini' },
      { value: 'github/openai/text-embedding-3-small', label: 'Text Embedding 3 (small)' },
      { value: 'github/openai/text-embedding-3-large', label: 'Text Embedding 3 (large)' },
      { value: 'github/meta/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B 16E Instruct' },
      { value: 'github/meta/llama-4-maverick-17b-128e-instruct-fp8', label: 'Llama 4 Maverick 17B 128E Instruct FP8' },
      { value: 'github/meta/llama-3.3-70b-instruct', label: 'Llama-3.3-70B-Instruct' },
      { value: 'github/meta/llama-3.2-90b-vision-instruct', label: 'Llama-3.2-90B-Vision-Instruct' },
      { value: 'github/meta/llama-3.2-11b-vision-instruct', label: 'Llama-3.2-11B-Vision-Instruct' },
      { value: 'github/meta/meta-llama-3.1-405b-instruct', label: 'Meta-Llama-3.1-405B-Instruct' },
      { value: 'github/meta/meta-llama-3.1-8b-instruct', label: 'Meta-Llama-3.1-8B-Instruct' },
      { value: 'github/mistralai/mistral-medium-3', label: 'Mistral Medium 3 (25.05)' },
      { value: 'github/mistralai/mistral-small-3.1', label: 'Mistral Small 3.1' },
      { value: 'github/mistralai/ministral-3b', label: 'Ministral 3B' },
      { value: 'github/mistralai/codestral-25.01', label: 'Codestral 25.01' },
      { value: 'github/deepseek-ai/deepseek-v3-0324', label: 'DeepSeek-V3-0324' },
      { value: 'github/deepseek-ai/deepseek-r1-0528', label: 'DeepSeek-R1-0528' },
      { value: 'github/deepseek-ai/deepseek-r1', label: 'DeepSeek-R1' },
      { value: 'github/cohere/command-a', label: 'Command A' },
      { value: 'github/cohere/command-r-plus-08-2024', label: 'Command R+ 08-2024' },
      { value: 'github/cohere/command-r-08-2024', label: 'Command R 08-2024' },
      { value: 'github/xai/grok-3', label: 'Grok 3' },
      { value: 'github/xai/grok-3-mini', label: 'Grok 3 Mini' },
    ],
  },
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
    if (key === 'voiceModel') {
      const nextVoiceModel = String(value)
      const autoTranscriptModel = isGeminiLiveModel(nextVoiceModel) ? 'gemini-2.0-flash-exp' : 'gpt-4o-mini-transcribe'
      onConfigChange({ ...config, voiceModel: nextVoiceModel, transcriptModel: autoTranscriptModel })
      return
    }
    onConfigChange({ ...config, [key]: value })
  }

  useEffect(() => {
    if (!isGeminiLiveModel(config.voiceModel)) return
    const safeVoiceModel = selectSupportedGoogleLiveModel(config.voiceModel)
    if (safeVoiceModel === config.voiceModel) return
    onConfigChange({
      ...config,
      voiceModel: safeVoiceModel,
      transcriptModel: 'gpt-4o-mini-transcribe',
    })
  }, [config, onConfigChange])

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
          <span className="audio-config-section-title">Models</span>
          <span className={`audio-config-chevron ${expandedSections.model ? 'open' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </button>
        {expandedSections.model && (
          <div className="audio-config-section-body">
            <div className="audio-config-sub-label">Voice model</div>
            <select
              className="audio-config-select"
              value={config.voiceModel}
              onChange={(e) => update('voiceModel', e.target.value)}
            >
              {VOICE_MODEL_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.models.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <div className="audio-config-sub-label">Reasoning model</div>
            <select
              className="audio-config-select"
              value={config.reasoningModel}
              onChange={(e) => update('reasoningModel', e.target.value)}
            >
              {REASONING_MODEL_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.models.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <div className="audio-config-sub-label">
              Transcription: automatic for selected Voice model
            </div>

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
