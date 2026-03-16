/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_AGENT_BASE_URL?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  readonly VITE_STRIPE_SUCCESS_URL?: string
  readonly VITE_STRIPE_CANCEL_URL?: string
  readonly VITE_STRIPE_PRICE_STARTER?: string
  readonly VITE_STRIPE_PRICE_DEVELOPER?: string
  readonly VITE_STRIPE_PRICE_TEAM?: string
  readonly VITE_STRIPE_PRICE_PRO?: string
  readonly VITE_STRIPE_PRICE_ENTERPRISE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
