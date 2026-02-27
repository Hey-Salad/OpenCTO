export type PlanCode = 'STARTER' | 'DEVELOPER' | 'TEAM' | 'PRO' | 'ENTERPRISE'
export type BillingInterval = 'MONTHLY' | 'YEARLY'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'

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
