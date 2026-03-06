import Stripe from 'stripe'
import type { Env, RequestContext } from './types'
import { BadRequestException, InternalServerException, jsonResponse } from './errors'

const API_VERSION = '2026-02-25.clover' as Stripe.LatestApiVersion

function getStripeClient(env: Env): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new InternalServerException('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
  })
}

let marketplaceSchemaReady = false

function getWorkspaceId(userId: string): string {
  return `ws-${userId}`
}

function safeUrl(raw: string): URL {
  try {
    return new URL(raw)
  } catch {
    throw new InternalServerException('APP_BASE_URL must be a valid URL')
  }
}

function appUrl(env: Env, path: string): string {
  const base = safeUrl(env.APP_BASE_URL || 'https://app.opencto.works')
  const pathname = path.startsWith('/') ? path : `/${path}`
  return `${base.origin}${pathname}`
}

function parsePositiveUsd(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new BadRequestException(`${fieldName} must be a positive number`) 
  }
  const rounded = Math.round(value * 100) / 100
  if (rounded <= 0) {
    throw new BadRequestException(`${fieldName} must be greater than zero`)
  }
  return rounded
}

function parseCurrency(value: unknown): string {
  const currency = typeof value === 'string' ? value.trim().toLowerCase() : 'usd'
  if (!/^[a-z]{3}$/.test(currency)) {
    throw new BadRequestException('currency must be a 3-letter ISO code')
  }
  return currency
}

function parseSlug(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${fieldName} is required`)
  }
  const cleaned = value.trim()
  if (!cleaned || cleaned.length > 120) {
    throw new BadRequestException(`${fieldName} must be between 1 and 120 chars`)
  }
  return cleaned
}

function toCents(amount: number): number {
  return Math.round(amount * 100)
}

function defaultPlatformFeePercent(env: Env): number {
  const raw = Number.parseFloat(env.OPENCTO_MARKETPLACE_PLATFORM_FEE_PERCENT || '')
  if (!Number.isFinite(raw)) return 12
  return Math.min(Math.max(raw, 0), 90)
}

async function ensureMarketplaceSchema(env: Env): Promise<void> {
  if (marketplaceSchemaReady) return

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS marketplace_connected_accounts (
      workspace_id TEXT PRIMARY KEY,
      stripe_account_id TEXT NOT NULL UNIQUE,
      business_name TEXT,
      country TEXT,
      charges_enabled INTEGER NOT NULL DEFAULT 0,
      payouts_enabled INTEGER NOT NULL DEFAULT 0,
      details_submitted INTEGER NOT NULL DEFAULT 0,
      onboarding_complete_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run()

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS agent_rental_contracts (
      id TEXT PRIMARY KEY,
      trace_id TEXT,
      renter_workspace_id TEXT NOT NULL,
      provider_workspace_id TEXT NOT NULL,
      provider_stripe_account_id TEXT NOT NULL,
      agent_slug TEXT NOT NULL,
      description TEXT,
      amount_cents INTEGER NOT NULL,
      platform_fee_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'usd',
      status TEXT NOT NULL,
      stripe_checkout_session_id TEXT,
      stripe_payment_intent_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run()
  await env.DB.prepare('ALTER TABLE agent_rental_contracts ADD COLUMN trace_id TEXT').run().catch(() => {})

  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_agent_rental_contracts_renter_created ON agent_rental_contracts (renter_workspace_id, created_at DESC)',
  ).run()

  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_agent_rental_contracts_provider_created ON agent_rental_contracts (provider_workspace_id, created_at DESC)',
  ).run()

  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_agent_rental_contracts_checkout_session ON agent_rental_contracts (stripe_checkout_session_id)',
  ).run()

  marketplaceSchemaReady = true
}

export async function createConnectedAccount(
  body: { businessName?: string; country?: string },
  ctx: RequestContext,
): Promise<Response> {
  const { env, user } = ctx
  await ensureMarketplaceSchema(env)
  const stripe = getStripeClient(env)
  const workspaceId = getWorkspaceId(user.id)

  const existing = await env.DB.prepare(
    `SELECT stripe_account_id FROM marketplace_connected_accounts WHERE workspace_id = ?`,
  )
    .bind(workspaceId)
    .first<{ stripe_account_id: string }>()

  if (existing?.stripe_account_id) {
    return jsonResponse({
      workspaceId,
      stripeAccountId: existing.stripe_account_id,
      alreadyExists: true,
    })
  }

  const account = await stripe.accounts.create({
    controller: {
      losses: { payments: 'application' },
      fees: { payer: 'application' },
      stripe_dashboard: { type: 'express' },
      requirement_collection: 'stripe',
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      name: body.businessName?.trim() || user.displayName,
    },
    metadata: {
      workspaceId,
      ownerUserId: user.id,
    },
    country: body.country?.toUpperCase() || 'US',
  })

  await env.DB.prepare(
    `INSERT INTO marketplace_connected_accounts (
      workspace_id, stripe_account_id, business_name, country, charges_enabled, payouts_enabled, details_submitted, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  )
    .bind(
      workspaceId,
      account.id,
      body.businessName?.trim() || user.displayName,
      account.country || body.country?.toUpperCase() || 'US',
      account.charges_enabled ? 1 : 0,
      account.payouts_enabled ? 1 : 0,
      account.details_submitted ? 1 : 0,
    )
    .run()

  return jsonResponse({
    workspaceId,
    stripeAccountId: account.id,
    onboardingComplete: account.details_submitted,
  })
}

export async function createConnectedAccountOnboardingLink(
  accountId: string,
  ctx: RequestContext,
): Promise<Response> {
  const { env, user } = ctx
  await ensureMarketplaceSchema(env)
  const workspaceId = getWorkspaceId(user.id)
  const stripe = getStripeClient(env)

  const existing = await env.DB.prepare(
    `SELECT stripe_account_id FROM marketplace_connected_accounts WHERE workspace_id = ? AND stripe_account_id = ?`,
  )
    .bind(workspaceId, accountId)
    .first<{ stripe_account_id: string }>()

  if (!existing) {
    throw new BadRequestException('Connected account not found for this workspace')
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: appUrl(env, '/marketplace/connect/refresh'),
    return_url: appUrl(env, '/marketplace/connect/complete'),
  })

  return jsonResponse({
    stripeAccountId: accountId,
    onboardingUrl: link.url,
    expiresAt: link.expires_at,
  })
}

export async function createAgentRentalCheckoutSession(
  body: {
    providerWorkspaceId?: string
    providerStripeAccountId?: string
    agentSlug?: string
    description?: string
    amountUsd?: number
    currency?: string
    platformFeePercent?: number
  },
  ctx: RequestContext,
): Promise<Response> {
  const { env, user } = ctx
  await ensureMarketplaceSchema(env)

  const renterWorkspaceId = getWorkspaceId(user.id)
  const providerWorkspaceId = parseSlug(body.providerWorkspaceId, 'providerWorkspaceId')
  const providerStripeAccountId = parseSlug(body.providerStripeAccountId, 'providerStripeAccountId')
  const agentSlug = parseSlug(body.agentSlug, 'agentSlug')
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 250) : ''
  const amountUsd = parsePositiveUsd(body.amountUsd, 'amountUsd')
  const currency = parseCurrency(body.currency)

  const platformFeePercent =
    typeof body.platformFeePercent === 'number' && Number.isFinite(body.platformFeePercent)
      ? Math.min(Math.max(body.platformFeePercent, 0), 90)
      : defaultPlatformFeePercent(env)

  const amountCents = toCents(amountUsd)
  const platformFeeCents = Math.round((amountCents * platformFeePercent) / 100)
  const contractId = crypto.randomUUID()

  await env.DB.prepare(
    `INSERT INTO agent_rental_contracts (
      id, trace_id, renter_workspace_id, provider_workspace_id, provider_stripe_account_id, agent_slug,
      description, amount_cents, platform_fee_cents, currency, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  )
    .bind(
      contractId,
      ctx.traceContext.traceId,
      renterWorkspaceId,
      providerWorkspaceId,
      providerStripeAccountId,
      agentSlug,
      description || null,
      amountCents,
      platformFeeCents,
      currency,
      'pending_checkout',
    )
    .run()

  const stripe = getStripeClient(env)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          product_data: {
            name: `Agent rental: ${agentSlug}`,
            description: description || `Rental contract ${contractId}`,
          },
          unit_amount: amountCents,
        },
      },
    ],
    payment_intent_data: {
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: providerStripeAccountId,
      },
      metadata: {
        contractId,
        agentSlug,
        renterWorkspaceId,
        providerWorkspaceId,
      },
    },
    metadata: {
      contractId,
      agentSlug,
      renterWorkspaceId,
      providerWorkspaceId,
      flow: 'agent_marketplace_rental',
    },
    success_url: `${appUrl(env, '/marketplace/rentals/success')}?contract_id=${contractId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl(env, '/marketplace/rentals/cancel')}?contract_id=${contractId}`,
  })

  await env.DB.prepare(
    `UPDATE agent_rental_contracts
     SET stripe_checkout_session_id = ?, status = 'checkout_created', updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(session.id, contractId)
    .run()

  return jsonResponse({
    contractId,
    traceId: ctx.traceContext.traceId,
    checkoutSessionId: session.id,
    checkoutUrl: session.url,
    amountCents,
    platformFeeCents,
    currency,
  })
}

export async function listMyAgentRentals(ctx: RequestContext): Promise<Response> {
  const { env, user } = ctx
  await ensureMarketplaceSchema(env)
  const workspaceId = getWorkspaceId(user.id)

  const rows = await env.DB.prepare(
    `SELECT id, trace_id, renter_workspace_id, provider_workspace_id, provider_stripe_account_id, agent_slug,
            description, amount_cents, platform_fee_cents, currency, status,
            stripe_checkout_session_id, stripe_payment_intent_id, created_at, updated_at
     FROM agent_rental_contracts
     WHERE renter_workspace_id = ? OR provider_workspace_id = ?
     ORDER BY created_at DESC
     LIMIT 100`,
  )
    .bind(workspaceId, workspaceId)
    .all<{
      id: string
      trace_id: string | null
      renter_workspace_id: string
      provider_workspace_id: string
      provider_stripe_account_id: string
      agent_slug: string
      description: string | null
      amount_cents: number
      platform_fee_cents: number
      currency: string
      status: string
      stripe_checkout_session_id: string | null
      stripe_payment_intent_id: string | null
      created_at: string
      updated_at: string
    }>()

  return jsonResponse({
    workspaceId,
    contracts: (rows.results || []).map((item) => ({
      id: item.id,
      traceId: item.trace_id,
      renterWorkspaceId: item.renter_workspace_id,
      providerWorkspaceId: item.provider_workspace_id,
      providerStripeAccountId: item.provider_stripe_account_id,
      agentSlug: item.agent_slug,
      description: item.description,
      amountCents: item.amount_cents,
      platformFeeCents: item.platform_fee_cents,
      currency: item.currency,
      status: item.status,
      checkoutSessionId: item.stripe_checkout_session_id,
      paymentIntentId: item.stripe_payment_intent_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
  })
}

export async function markRentalPaidFromCheckout(
  checkoutSessionId: string,
  paymentIntentId: string | null,
  env: Env,
): Promise<void> {
  await ensureMarketplaceSchema(env)
  await env.DB.prepare(
    `UPDATE agent_rental_contracts
     SET status = 'paid', stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id), updated_at = datetime('now')
     WHERE stripe_checkout_session_id = ?`,
  )
    .bind(paymentIntentId, checkoutSessionId)
    .run()
}
