import type { BillingApi } from '../api/billingClient'
import type {
  BillingInterval,
  BillingPortalSessionResponse,
  BillingSummaryResponse,
  CheckoutSessionResponse,
  InvoicesResponse,
  Plan,
  PlanCode,
} from '../types/billing'

export const plans: Plan[] = [
  {
    code: 'STARTER',
    name: 'Starter',
    description: 'Trial and sandbox usage',
    monthlyPriceUsd: 0,
    yearlyPriceUsd: 0,
    includedCodexCreditUsd: 5,
    features: ['1 user', '2 workers', 'Basic compliance logs'],
  },
  {
    code: 'DEVELOPER',
    name: 'Developer',
    description: 'Solo workflow for daily delivery',
    monthlyPriceUsd: 29,
    yearlyPriceUsd: 290,
    includedCodexCreditUsd: 30,
    features: ['3 users', '6 workers', 'Standard audit exports'],
  },
  {
    code: 'TEAM',
    name: 'Team',
    description: 'Cross-functional squads',
    monthlyPriceUsd: 99,
    yearlyPriceUsd: 990,
    includedCodexCreditUsd: 120,
    highlighted: true,
    features: ['15 users', '20 workers', 'Approval policies + insights'],
  },
  {
    code: 'PRO',
    name: 'Pro',
    description: 'Scaling platform orgs',
    monthlyPriceUsd: 249,
    yearlyPriceUsd: 2490,
    includedCodexCreditUsd: 350,
    features: ['50 users', '60 workers', 'Extended compliance evidence'],
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Security and governance heavy workloads',
    monthlyPriceUsd: null,
    yearlyPriceUsd: null,
    includedCodexCreditUsd: 0,
    features: ['SAML and device trust', 'Private networking', 'Dedicated support'],
  },
]

const summary: BillingSummaryResponse = {
  currentPlan: plans[2],
  subscription: {
    id: 'sub_123',
    customerId: 'cus_abc',
    planCode: 'TEAM',
    status: 'active',
    interval: 'MONTHLY',
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    cancelAtPeriodEnd: false,
  },
  usage: {
    jobsUsed: 382,
    jobsLimit: 1000,
    workersUsed: 14,
    workersLimit: 20,
    usersUsed: 12,
    usersLimit: 15,
    codexCreditUsedUsd: 83.24,
    codexCreditLimitUsd: 120,
  },
}

const invoices: InvoicesResponse = {
  invoices: [
    {
      id: 'in_1',
      number: 'INV-2026-002',
      createdAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
      amountPaidUsd: 99,
      currency: 'USD',
      status: 'paid',
    },
    {
      id: 'in_2',
      number: 'INV-2026-001',
      createdAt: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString(),
      amountPaidUsd: 99,
      currency: 'USD',
      status: 'paid',
    },
  ],
}

export class BillingMockAdapter implements BillingApi {
  async createCheckoutSession(planCode: PlanCode, interval: BillingInterval): Promise<CheckoutSessionResponse> {
    return {
      sessionId: `cs_test_${planCode.toLowerCase()}_${interval.toLowerCase()}`,
      checkoutUrl: 'https://checkout.stripe.com/mock-session',
    }
  }

  async createBillingPortalSession(): Promise<BillingPortalSessionResponse> {
    return {
      url: 'https://billing.stripe.com/mock-portal',
    }
  }

  async fetchSubscriptionSummary(): Promise<BillingSummaryResponse> {
    return structuredClone(summary)
  }

  async fetchInvoices(): Promise<InvoicesResponse> {
    return structuredClone(invoices)
  }
}
