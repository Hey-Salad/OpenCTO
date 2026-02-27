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

function readRequired(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export function getStripePublicConfig(): StripePublicConfig {
  return {
    publishableKey: readRequired('VITE_STRIPE_PUBLISHABLE_KEY'),
    defaultSuccessUrl: readRequired('VITE_STRIPE_SUCCESS_URL'),
    defaultCancelUrl: readRequired('VITE_STRIPE_CANCEL_URL'),
    priceIds: {
      starter: readRequired('VITE_STRIPE_PRICE_STARTER'),
      developer: readRequired('VITE_STRIPE_PRICE_DEVELOPER'),
      team: readRequired('VITE_STRIPE_PRICE_TEAM'),
      pro: readRequired('VITE_STRIPE_PRICE_PRO'),
      enterprise: readRequired('VITE_STRIPE_PRICE_ENTERPRISE'),
    },
  }
}

export function getStripeMissingEnvVars(): string[] {
  return requiredKeys.filter((key) => {
    const value = import.meta.env[key]
    return !value || value.trim().length === 0
  })
}
