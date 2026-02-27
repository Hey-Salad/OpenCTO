import { getStripeMissingEnvVars, getStripePublicConfig } from './stripe'

const completeEnv: ImportMetaEnv = {
  VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_public',
  VITE_STRIPE_SUCCESS_URL: 'https://opencto.works/success',
  VITE_STRIPE_CANCEL_URL: 'https://opencto.works/cancel',
  VITE_STRIPE_PRICE_STARTER: 'price_starter',
  VITE_STRIPE_PRICE_DEVELOPER: 'price_developer',
  VITE_STRIPE_PRICE_TEAM: 'price_team',
  VITE_STRIPE_PRICE_PRO: 'price_pro',
  VITE_STRIPE_PRICE_ENTERPRISE: 'price_enterprise',
} as ImportMetaEnv

test('returns missing Stripe env vars deterministically', () => {
  const env = {
    ...completeEnv,
    VITE_STRIPE_PRICE_TEAM: '   ',
    VITE_STRIPE_PRICE_PRO: undefined,
  } as ImportMetaEnv

  expect(getStripeMissingEnvVars(env)).toEqual(['VITE_STRIPE_PRICE_TEAM', 'VITE_STRIPE_PRICE_PRO'])
})

test('throws without exposing secret-like values when required env is missing', () => {
  const env = {
    ...completeEnv,
    VITE_STRIPE_PUBLISHABLE_KEY: '',
  } as ImportMetaEnv

  expect(() => getStripePublicConfig(env)).toThrow('Missing required env var: VITE_STRIPE_PUBLISHABLE_KEY')
  expect(() => getStripePublicConfig(env)).not.toThrow('pk_test_public')
})
