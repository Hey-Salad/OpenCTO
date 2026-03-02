const FALLBACK_API_BASE = 'https://api.opencto.works'
const LEGACY_WORKERS_HOST = 'opencto-api-worker.heysalad-o.workers.dev'

export function getApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
  if (!configured) return FALLBACK_API_BASE
  if (configured.includes(LEGACY_WORKERS_HOST)) return FALLBACK_API_BASE
  return configured
}
