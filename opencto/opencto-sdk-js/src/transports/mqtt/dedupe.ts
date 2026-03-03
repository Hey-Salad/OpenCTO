import type { MqttEnvelope, MqttTransportDedupeOptions } from '../../types/mqtt'

export interface MqttEnvelopeDedupe {
  seen(envelope: MqttEnvelope): boolean
  clear(): void
}

const DEFAULT_TTL_MS = 5 * 60 * 1000
const DEFAULT_MAX_ENTRIES = 10_000

interface EntryRecord {
  seenAtMs: number
}

export function createMqttEnvelopeDedupe(
  options: MqttTransportDedupeOptions = {},
): MqttEnvelopeDedupe {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  const now = options.now ?? (() => Date.now())
  const entries = new Map<string, EntryRecord>()

  function toKey(envelope: MqttEnvelope): string {
    return `${envelope.workspaceId}:${envelope.idempotencyKey ?? envelope.id}`
  }

  function cleanup(currentMs: number): void {
    for (const [key, entry] of entries) {
      if (currentMs - entry.seenAtMs > ttlMs) {
        entries.delete(key)
      }
    }

    while (entries.size > maxEntries) {
      const first = entries.keys().next()
      if (first.done) break
      entries.delete(first.value)
    }
  }

  return {
    seen(envelope: MqttEnvelope): boolean {
      const currentMs = now()
      cleanup(currentMs)
      const key = toKey(envelope)
      const existing = entries.get(key)
      if (existing && currentMs - existing.seenAtMs <= ttlMs) {
        return true
      }
      entries.set(key, { seenAtMs: currentMs })
      return false
    },

    clear() {
      entries.clear()
    },
  }
}
