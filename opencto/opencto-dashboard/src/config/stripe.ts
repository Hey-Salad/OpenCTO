export interface StripePublicConfig {
  publishableKey: string
  defaultSuccessUrl: string
  defaultCancelUrl: string
  priceIds: {
    starter: string
    developer: string
    team: string
    pro: string
    enterprise: string
  }
}

const requiredKeys = [
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'VITE_STRIPE_SUCCESS_URL',
  'VITE_STRIPE_CANCEL_URL',
  'VITE_STRIPE_PRICE_STARTER',
  'VITE_STRIPE_PRICE_DEVELOPER',
  'VITE_STRIPE_PRICE_TEAM',
  'VITE_STRIPE_PRICE_PRO',
  'VITE_STRIPE_PRICE_ENTERPRISE',
] as const

export type StripePublicEnvKey = (typeof requiredKeys)[number]

function readRequired(env: ImportMetaEnv, name: StripePublicEnvKey): string {
  const value = env[name]
  if (!value || value.trim().length === 0) {
    // Keep error content key-only so no env values are ever surfaced.
    throw new Error(`Missing required env var: ${name}`)
  }

  return value
}

export function getStripePublicConfig(env: ImportMetaEnv = import.meta.env): StripePublicConfig {
  return {
    publishableKey: readRequired(env, 'VITE_STRIPE_PUBLISHABLE_KEY'),
    defaultSuccessUrl: readRequired(env, 'VITE_STRIPE_SUCCESS_URL'),
    defaultCancelUrl: readRequired(env, 'VITE_STRIPE_CANCEL_URL'),
    priceIds: {
      starter: readRequired(env, 'VITE_STRIPE_PRICE_STARTER'),
      developer: readRequired(env, 'VITE_STRIPE_PRICE_DEVELOPER'),
      team: readRequired(env, 'VITE_STRIPE_PRICE_TEAM'),
      pro: readRequired(env, 'VITE_STRIPE_PRICE_PRO'),
      enterprise: readRequired(env, 'VITE_STRIPE_PRICE_ENTERPRISE'),
    },
  }
}

export function getStripeMissingEnvVars(env: ImportMetaEnv = import.meta.env): StripePublicEnvKey[] {
  return requiredKeys.filter((key) => {
    const value = env[key]
    return !value || value.trim().length === 0
  })
}
