export type AssistantOutputKind = 'speech' | 'code' | 'command' | 'output' | 'artifact' | 'plan'

export interface AssistantOutputBlock {
  kind: AssistantOutputKind
  text: string
  metadata?: {
    language?: string
    command?: string
    title?: string
  }
}

function splitCodeFences(text: string): Array<{ type: 'plain' | 'code'; text: string; language?: string }> {
  const parts: Array<{ type: 'plain' | 'code'; text: string; language?: string }> = []
  const regex = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g
  let last = 0
  let match: RegExpExecArray | null = regex.exec(text)

  while (match) {
    if (match.index > last) {
      parts.push({ type: 'plain', text: text.slice(last, match.index) })
    }
    parts.push({
      type: 'code',
      language: (match[1] ?? '').trim() || undefined,
      text: match[2].trim(),
    })
    last = match.index + match[0].length
    match = regex.exec(text)
  }

  if (last < text.length) {
    parts.push({ type: 'plain', text: text.slice(last) })
  }

  return parts
}

function parsePlainText(text: string): AssistantOutputBlock[] {
  const blocks: AssistantOutputBlock[] = []
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      i += 1
      continue
    }

    if (line.startsWith('$ ')) {
      const command = line.slice(2).trim()
      if (command) {
        blocks.push({ kind: 'command', text: command, metadata: { command } })
      }
      i += 1
      continue
    }

    if (line.toUpperCase().startsWith('OUTPUT:')) {
      const outputLines: string[] = []
      const first = line.slice('OUTPUT:'.length).trim()
      if (first) outputLines.push(first)
      i += 1
      while (i < lines.length && lines[i].trim()) {
        outputLines.push(lines[i])
        i += 1
      }
      if (outputLines.length > 0) {
        blocks.push({ kind: 'output', text: outputLines.join('\n') })
      }
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length) {
        const next = lines[i].trim()
        if (!/^\d+\.\s+/.test(next)) break
        items.push(next.replace(/^\d+\.\s+/, '').trim())
        i += 1
      }
      if (items.length > 0) {
        blocks.push({ kind: 'plan', text: items.join('\n') })
      }
      continue
    }

    const paragraph: string[] = [line]
    i += 1
    while (i < lines.length) {
      const next = lines[i].trim()
      if (!next) break
      if (next.startsWith('$ ') || next.toUpperCase().startsWith('OUTPUT:') || /^\d+\.\s+/.test(next)) break
      paragraph.push(next)
      i += 1
    }
    blocks.push({ kind: 'speech', text: paragraph.join(' ') })
  }

  return blocks
}

export function sanitizeAssistantNarration(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const lower = trimmed.toLowerCase()
  const looksLikeInternalPreamble = (
    lower.includes('initiating conversation response')
    || (lower.includes('my goal is') && lower.includes('persona'))
    || lower.includes('working on the tone and format')
  )

  if (!looksLikeInternalPreamble) return trimmed

  const lines = trimmed.split('\n').filter((line) => {
    const l = line.trim().toLowerCase()
    if (!l) return false
    if (l.includes('initiating conversation response')) return false
    if (l.includes('my goal is')) return false
    if (l.includes('maintain my persona')) return false
    if (l.includes('working on the tone and format')) return false
    return true
  })

  return lines.join('\n').trim()
}

export function parseAssistantOutput(text: string): AssistantOutputBlock[] {
  const cleaned = sanitizeAssistantNarration(text)
  if (!cleaned) return []

  const blocks: AssistantOutputBlock[] = []
  const chunks = splitCodeFences(cleaned)

  for (const chunk of chunks) {
    if (chunk.type === 'code') {
      if (chunk.text) {
        blocks.push({ kind: 'code', text: chunk.text, metadata: { language: chunk.language } })
      }
      continue
    }
    blocks.push(...parsePlainText(chunk.text))
  }

  const hasTechnical = blocks.some((b) => b.kind === 'code' || b.kind === 'command' || b.kind === 'output')
  const hasSpeech = blocks.some((b) => b.kind === 'speech' && b.text.trim().length > 0)

  if (hasTechnical && !hasSpeech) {
    blocks.unshift({
      kind: 'speech',
      text: "I've prepared code and command output in the workspace.",
    })
  }

  return blocks
}
