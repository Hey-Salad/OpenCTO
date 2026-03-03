import type { MqttTransportDeliveryOptions } from '../../types/mqtt'

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_ACK_TIMEOUT_MS = 5_000
const DEFAULT_INITIAL_BACKOFF_MS = 200
const DEFAULT_MAX_BACKOFF_MS = 2_000
const DEFAULT_BACKOFF_MULTIPLIER = 2
const DEFAULT_JITTER_RATIO = 0.2

export async function publishWithRetry(
  publish: () => Promise<void>,
  options: MqttTransportDeliveryOptions = {},
): Promise<void> {
  const enabled = options.enabled !== false
  const maxAttempts = enabled ? Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS) : 1
  const ackTimeoutMs = options.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS
  const initialBackoffMs = options.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS
  const maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS
  const backoffMultiplier = options.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER
  const jitterRatio = options.jitterRatio ?? DEFAULT_JITTER_RATIO
  const sleep = options.sleep ?? wait
  const random = options.random ?? Math.random

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await withTimeout(publish(), ackTimeoutMs)
      return
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts) break
      const baseBackoff = Math.min(
        maxBackoffMs,
        initialBackoffMs * Math.pow(backoffMultiplier, attempt - 1),
      )
      const jitter = baseBackoff * jitterRatio * random()
      await sleep(Math.round(baseBackoff + jitter))
    }
  }

  throw new Error(`MQTT publish failed after ${maxAttempts} attempt(s)`, {
    cause: lastError,
  })
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) return promise
  let timeout: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`MQTT publish ack timeout after ${timeoutMs}ms`))
    }, timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
