export type PlanCode = 'STARTER' | 'DEVELOPER' | 'TEAM' | 'PRO' | 'ENTERPRISE'
export type BillingInterval = 'MONTHLY' | 'YEARLY'
export type KnownSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'
export type SubscriptionStatus = KnownSubscriptionStatus | (string & {})
export type SubscriptionStatusTone = KnownSubscriptionStatus | 'unknown'

export interface Plan {
  code: PlanCode
  name: string
  description: string
  monthlyPriceUsd: number | null
  yearlyPriceUsd: number | null
  includedCodexCreditUsd: number
  highlighted?: boolean
  features: string[]
}

export interface Subscription {
  id: string
  customerId: string
  planCode: PlanCode
  status: SubscriptionStatus
  interval: BillingInterval
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

export interface Invoice {
  id: string
  number: string
  createdAt: string
  amountPaidUsd: number
  currency: 'USD'
  status: 'paid' | 'open' | 'void' | 'uncollectible'
  hostedInvoiceUrl?: string
  pdfUrl?: string
}

export interface UsageSummary {
  jobsUsed: number
  jobsLimit: number | null
  workersUsed: number
  workersLimit: number | null
  usersUsed: number
  usersLimit: number | null
  codexCreditUsedUsd: number
  codexCreditLimitUsd: number | null
}

export interface CheckoutSessionResponse {
  sessionId: string
  checkoutUrl: string
}

export interface BillingPortalSessionResponse {
  url: string
}

export interface BillingSummaryResponse {
  subscription: Subscription
  usage: UsageSummary
  currentPlan: Plan
}

export interface InvoicesResponse {
  invoices: Invoice[]
}

const knownSubscriptionStatuses: ReadonlySet<KnownSubscriptionStatus> = new Set([
  'trialing',
  'active',
  'past_due',
  'canceled',
])

export function toSubscriptionStatusTone(status: string | null | undefined): SubscriptionStatusTone {
  if (!status) {
    return 'unknown'
  }

  return knownSubscriptionStatuses.has(status as KnownSubscriptionStatus)
    ? (status as KnownSubscriptionStatus)
    : 'unknown'
}

export function toSubscriptionStatusLabel(status: string | null | undefined): string {
  const tone = toSubscriptionStatusTone(status)
  if (tone === 'unknown') {
    return 'Unknown'
  }

  return tone.replace('_', ' ')
}
