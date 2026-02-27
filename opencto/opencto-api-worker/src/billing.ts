// Billing handlers for OpenCTO API
// Implements Stripe checkout, portal, subscription, and invoice management

import Stripe from 'stripe'
import type {
  RequestContext,
  PlanCode,
  BillingInterval,
  Subscription,
  Invoice,
  UsageSummary,
  Plan,
} from './types'
import { jsonResponse, BadRequestException } from './errors'
import { getPlanLimits } from './entitlements'

// Plan definitions (matching frontend)
const PLANS: Record<PlanCode, Plan> = {
  STARTER: {
    code: 'STARTER',
    name: 'Starter',
    description: 'Perfect for individual developers',
    monthlyPriceUsd: 29,
    yearlyPriceUsd: 290,
    includedCodexCreditUsd: 10,
    features: ['10 jobs/month', '1 worker', '1 user', '$10 Codex credit'],
  },
  DEVELOPER: {
    code: 'DEVELOPER',
    name: 'Developer',
    description: 'For professional developers',
    monthlyPriceUsd: 99,
    yearlyPriceUsd: 990,
    includedCodexCreditUsd: 50,
    features: ['100 jobs/month', '3 workers', '3 users', '$50 Codex credit', 'Dangerous approvals'],
  },
  TEAM: {
    code: 'TEAM',
    name: 'Team',
    description: 'For growing teams',
    monthlyPriceUsd: 299,
    yearlyPriceUsd: 2990,
    includedCodexCreditUsd: 200,
    highlighted: true,
    features: [
      '500 jobs/month',
      '10 workers',
      '10 users',
      '$200 Codex credit',
      'Compliance export',
      'Priority support',
    ],
  },
  PRO: {
    code: 'PRO',
    name: 'Pro',
    description: 'For professional teams',
    monthlyPriceUsd: 999,
    yearlyPriceUsd: 9990,
    includedCodexCreditUsd: 1000,
    features: [
      'Unlimited jobs',
      'Unlimited workers',
      '25 users',
      '$1,000 Codex credit',
      'Advanced compliance',
      'Priority support',
    ],
  },
  ENTERPRISE: {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
    monthlyPriceUsd: null,
    yearlyPriceUsd: null,
    includedCodexCreditUsd: 0,
    features: [
      'Custom limits',
      'Unlimited users',
      'Custom Codex credit',
      'SLA guarantees',
      'Dedicated support',
      'Custom integrations',
    ],
  },
}

// Initialize Stripe client
function getStripeClient(env: RequestContext['env']): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-04-10',
    httpClient: Stripe.createFetchHttpClient(),
  })
}

// POST /api/v1/billing/checkout/session
export async function createCheckoutSession(
  planCode: PlanCode,
  interval: BillingInterval,
  ctx: RequestContext
): Promise<Response> {
  const { user, env } = ctx

  // Validate plan
  const plan = PLANS[planCode]
  if (!plan) {
    throw new BadRequestException('Invalid plan code')
  }

  // Enterprise requires custom pricing
  if (planCode === 'ENTERPRISE') {
    throw new BadRequestException('Enterprise plans require custom pricing. Contact sales.')
  }

  const price = interval === 'MONTHLY' ? plan.monthlyPriceUsd : plan.yearlyPriceUsd
  if (!price) {
    throw new BadRequestException('Invalid billing interval for plan')
  }

  const stripe = getStripeClient(env)

  // Create or get customer
  let customerId = await getCustomerId(user.id, env)
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.displayName,
      metadata: {
        userId: user.id,
      },
    })
    customerId = customer.id
  }

  // Create checkout session
  // Note: In production, you would use actual Stripe price IDs from env vars
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${plan.name} Plan`,
            description: plan.description,
          },
          unit_amount: price * 100, // Convert to cents
          recurring: {
            interval: interval === 'MONTHLY' ? 'month' : 'year',
          },
        },
        quantity: 1,
      },
    ],
    success_url: 'https://opencto.works/billing/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://opencto.works/billing/cancel',
    metadata: {
      userId: user.id,
      planCode,
      interval,
    },
  })

  return jsonResponse({
    sessionId: session.id,
    checkoutUrl: session.url || '',
  })
}

// POST /api/v1/billing/portal/session
export async function createBillingPortalSession(ctx: RequestContext): Promise<Response> {
  const { user, env } = ctx

  const customerId = await getCustomerId(user.id, env)
  if (!customerId) {
    throw new BadRequestException('No billing account found')
  }

  const stripe = getStripeClient(env)
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: 'https://opencto.works/billing',
  })

  return jsonResponse({
    url: session.url,
  })
}

// GET /api/v1/billing/subscription
export async function getSubscriptionSummary(ctx: RequestContext): Promise<Response> {
  const { user, env } = ctx

  // Get subscription from database
  const subResult = await env.DB.prepare(
    `SELECT id, customer_id, plan_code, status, interval, current_period_start, current_period_end, cancel_at_period_end
     FROM subscriptions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(user.id)
    .first<{
      id: string
      customer_id: string
      plan_code: string
      status: string
      interval: string
      current_period_start: string
      current_period_end: string
      cancel_at_period_end: number
    }>()

  if (!subResult) {
    throw new BadRequestException('No active subscription found')
  }

  const subscription: Subscription = {
    id: subResult.id,
    customerId: subResult.customer_id,
    planCode: subResult.plan_code as PlanCode,
    status: subResult.status,
    interval: subResult.interval as BillingInterval,
    currentPeriodStart: subResult.current_period_start,
    currentPeriodEnd: subResult.current_period_end,
    cancelAtPeriodEnd: subResult.cancel_at_period_end === 1,
  }

  // Get usage metrics
  const usage = await getUserUsage(user.id, subscription.planCode, env)

  // Get plan details
  const currentPlan = PLANS[subscription.planCode]

  return jsonResponse({
    subscription,
    usage,
    currentPlan,
  })
}

// GET /api/v1/billing/invoices
export async function getInvoices(ctx: RequestContext): Promise<Response> {
  const { user, env } = ctx

  // Get subscription ID
  const subscription = await env.DB.prepare(
    'SELECT id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
  )
    .bind(user.id)
    .first<{ id: string }>()

  if (!subscription) {
    return jsonResponse({ invoices: [] })
  }

  // Get invoices
  const result = await env.DB.prepare(
    `SELECT id, number, amount_paid_usd, currency, status, hosted_invoice_url, pdf_url, created_at
     FROM invoices
     WHERE subscription_id = ?
     ORDER BY created_at DESC
     LIMIT 100`
  )
    .bind(subscription.id)
    .all<{
      id: string
      number: string
      amount_paid_usd: number
      currency: string
      status: string
      hosted_invoice_url: string | null
      pdf_url: string | null
      created_at: string
    }>()

  const invoices: Invoice[] = (result.results || []).map((row) => ({
    id: row.id,
    number: row.number,
    createdAt: row.created_at,
    amountPaidUsd: row.amount_paid_usd / 100, // Convert from cents
    currency: row.currency as 'USD',
    status: row.status as Invoice['status'],
    hostedInvoiceUrl: row.hosted_invoice_url || undefined,
    pdfUrl: row.pdf_url || undefined,
  }))

  return jsonResponse({ invoices })
}

// Helper function to get customer ID
async function getCustomerId(userId: string, env: RequestContext['env']): Promise<string | null> {
  const result = await env.DB.prepare(
    'SELECT customer_id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
  )
    .bind(userId)
    .first<{ customer_id: string }>()

  return result?.customer_id || null
}

// Helper function to get user usage with plan limits
async function getUserUsage(
  userId: string,
  planCode: PlanCode,
  env: RequestContext['env']
): Promise<UsageSummary> {
  const result = await env.DB.prepare(
    `SELECT jobs_used, workers_used, users_used, codex_credit_used_usd
     FROM usage_metrics
     WHERE user_id = ?
     AND datetime(period_end) > datetime('now')
     ORDER BY period_start DESC
     LIMIT 1`
  )
    .bind(userId)
    .first<{
      jobs_used: number
      workers_used: number
      users_used: number
      codex_credit_used_usd: number
    }>()

  const limits = getPlanLimits(planCode)

  return {
    jobsUsed: result?.jobs_used || 0,
    jobsLimit: limits?.jobsLimit || null,
    workersUsed: result?.workers_used || 0,
    workersLimit: limits?.workersLimit || null,
    usersUsed: result?.users_used || 1,
    usersLimit: limits?.usersLimit || null,
    codexCreditUsedUsd: result ? result.codex_credit_used_usd / 100 : 0,
    codexCreditLimitUsd: limits?.codexCreditLimitUsd || null,
  }
}
