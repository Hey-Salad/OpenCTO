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
import { InternalServerException } from './errors'
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
  if (!env.STRIPE_SECRET_KEY) {
    throw new InternalServerException('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover' as Stripe.LatestApiVersion,
    httpClient: Stripe.createFetchHttpClient(),
  })
}

let billingSchemaReady = false

async function ensureBillingSchema(env: RequestContext['env']): Promise<void> {
  if (billingSchemaReady) return
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS workspace_billing (
      workspace_id TEXT PRIMARY KEY,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      plan_code TEXT NOT NULL DEFAULT 'STARTER',
      interval TEXT NOT NULL DEFAULT 'MONTHLY',
      status TEXT NOT NULL DEFAULT 'inactive',
      current_period_end TEXT,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run()
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      stripe_invoice_id TEXT UNIQUE NOT NULL,
      number TEXT NOT NULL,
      amount_paid_usd INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL,
      hosted_invoice_url TEXT,
      pdf_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run()
  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_invoices_workspace_created ON invoices (workspace_id, created_at DESC)',
  ).run()
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS usage_metrics (
      workspace_id TEXT NOT NULL,
      jobs_used INTEGER NOT NULL DEFAULT 0,
      workers_used INTEGER NOT NULL DEFAULT 0,
      users_used INTEGER NOT NULL DEFAULT 1,
      codex_credit_used_usd INTEGER NOT NULL DEFAULT 0,
      period_start TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      period_end TEXT NOT NULL
    )`,
  ).run()
  billingSchemaReady = true
}

function getWorkspaceId(userId: string): string {
  return `ws-${userId}`
}

function appUrl(env: RequestContext['env'], path: string): string {
  const base = safeAppBaseUrl(env.APP_BASE_URL || 'https://app.opencto.works').replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

// POST /api/v1/billing/checkout/session
export async function createCheckoutSession(
  planCode: PlanCode,
  interval: BillingInterval,
  ctx: RequestContext
): Promise<Response> {
  const { user, env } = ctx
  if (interval !== 'MONTHLY' && interval !== 'YEARLY') {
    throw new BadRequestException('Invalid billing interval')
  }

  await ensureBillingSchema(env)
  const workspaceId = getWorkspaceId(user.id)

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
  let customerId = await getCustomerId(workspaceId, env)
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.displayName,
      metadata: {
        userId: user.id,
        workspaceId,
      },
    })
    customerId = customer.id

    await env.DB.prepare(
      `INSERT INTO workspace_billing (workspace_id, stripe_customer_id, plan_code, interval, status, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(workspace_id) DO UPDATE SET
         stripe_customer_id = excluded.stripe_customer_id,
         updated_at = excluded.updated_at`,
    )
      .bind(workspaceId, customerId, planCode, interval, 'pending')
      .run()
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
    success_url: `${appUrl(env, '/billing/success')}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: appUrl(env, '/billing/cancel'),
    metadata: {
      userId: user.id,
      workspaceId,
      planCode,
      interval,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        workspaceId,
        planCode,
        interval,
      },
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
  await ensureBillingSchema(env)
  const workspaceId = getWorkspaceId(user.id)

  const customerId = await getCustomerId(workspaceId, env)
  if (!customerId) {
    throw new BadRequestException('No billing account found')
  }

  const stripe = getStripeClient(env)
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: appUrl(env, '/billing'),
  })

  return jsonResponse({
    url: session.url,
  })
}

// GET /api/v1/billing/subscription
export async function getSubscriptionSummary(ctx: RequestContext): Promise<Response> {
  const { user, env } = ctx
  await ensureBillingSchema(env)
  const workspaceId = getWorkspaceId(user.id)

  let subResult = await env.DB.prepare(
    `SELECT workspace_id, stripe_customer_id, stripe_subscription_id, plan_code, status, interval, current_period_end, cancel_at_period_end
     FROM workspace_billing
     WHERE workspace_id = ?`
  )
    .bind(workspaceId)
    .first<{
      workspace_id: string
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
      plan_code: string
      status: string
      interval: string
      current_period_end: string | null
      cancel_at_period_end: number
    }>()

  if (!subResult) {
    // Bootstrap a default starter subscription row so first-time users can load billing without errors.
    await env.DB.prepare(
      `INSERT INTO workspace_billing (workspace_id, plan_code, interval, status, current_period_end, updated_at)
       VALUES (?, ?, ?, ?, datetime('now', '+30 days'), datetime('now'))`,
    ).bind(workspaceId, 'STARTER', 'MONTHLY', 'trialing').run()

    subResult = await env.DB.prepare(
      `SELECT workspace_id, stripe_customer_id, stripe_subscription_id, plan_code, status, interval, current_period_end, cancel_at_period_end
       FROM workspace_billing
       WHERE workspace_id = ?`,
    ).bind(workspaceId).first<{
      workspace_id: string
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
      plan_code: string
      status: string
      interval: string
      current_period_end: string | null
      cancel_at_period_end: number
    }>()
  }

  if (!subResult) {
    throw new BadRequestException('Billing workspace could not be initialized')
  }

  const planCode = (subResult.plan_code in PLANS ? subResult.plan_code : 'STARTER') as PlanCode
  const interval: BillingInterval = subResult.interval === 'YEARLY' ? 'YEARLY' : 'MONTHLY'

  const subscription: Subscription = {
    id: subResult.stripe_subscription_id || `sub-local-${workspaceId}`,
    customerId: subResult.stripe_customer_id || '',
    planCode,
    status: subResult.status,
    interval,
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: subResult.current_period_end || new Date().toISOString(),
    cancelAtPeriodEnd: subResult.cancel_at_period_end === 1,
  }

  const usage = await getWorkspaceUsage(workspaceId, subscription.planCode, env)

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
  await ensureBillingSchema(env)
  const workspaceId = getWorkspaceId(user.id)

  const result = await env.DB.prepare(
    `SELECT stripe_invoice_id as id, number, amount_paid_usd, currency, status, hosted_invoice_url, pdf_url, created_at
     FROM invoices
     WHERE workspace_id = ?
     ORDER BY created_at DESC
     LIMIT 100`
  )
    .bind(workspaceId)
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

async function getCustomerId(workspaceId: string, env: RequestContext['env']): Promise<string | null> {
  const result = await env.DB.prepare(
    'SELECT stripe_customer_id FROM workspace_billing WHERE workspace_id = ?'
  )
    .bind(workspaceId)
    .first<{ stripe_customer_id: string | null }>()

  return result?.stripe_customer_id || null
}

async function getWorkspaceUsage(
  workspaceId: string,
  planCode: PlanCode,
  env: RequestContext['env']
): Promise<UsageSummary> {
  let result: {
    jobs_used: number
    workers_used: number
    users_used: number
    codex_credit_used_usd: number
  } | null = null
  try {
    result = await env.DB.prepare(
      `SELECT jobs_used, workers_used, users_used, codex_credit_used_usd
       FROM usage_metrics
       WHERE workspace_id = ?
       AND datetime(period_end) > datetime('now')
       ORDER BY period_start DESC
       LIMIT 1`
    )
      .bind(workspaceId)
      .first<{
        jobs_used: number
        workers_used: number
        users_used: number
        codex_credit_used_usd: number
      }>()
  } catch {
    result = null
  }

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

function safeAppBaseUrl(raw: string): string {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return 'https://app.opencto.works'
    return url.origin
  } catch {
    return 'https://app.opencto.works'
  }
}
