// Stripe webhook handler with signature verification and idempotency
// SECURITY: Always verify webhook signatures to prevent spoofing

import Stripe from 'stripe'
import type { Env, PlanCode, BillingInterval } from './types'
import { jsonResponse, BadRequestException, InternalServerException } from './errors'
import { markRentalPaidFromCheckout } from './marketplace'

// Initialize Stripe client
function getStripeClient(env: Env): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new InternalServerException('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover' as Stripe.LatestApiVersion,
    httpClient: Stripe.createFetchHttpClient(),
  })
}

let webhookSchemaReady = false

async function ensureWebhookSchema(env: Env): Promise<void> {
  if (webhookSchemaReady) return
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS billing_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ).run()
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
  webhookSchemaReady = true
}

// POST /api/v1/billing/webhooks/stripe
export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.DB) {
    throw new InternalServerException('D1 database is not configured')
  }

  // Get raw body for signature verification
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  const contentType = request.headers.get('content-type') ?? ''

  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new BadRequestException('Invalid content-type for Stripe webhook')
  }

  if (!signature) {
    throw new BadRequestException('Missing stripe-signature header')
  }

  const stripe = getStripeClient(env)
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new InternalServerException('STRIPE_WEBHOOK_SECRET is not configured')
  }

  // Verify webhook signature
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err instanceof Error ? err.message : 'Unknown error')
    throw new BadRequestException('Invalid webhook signature')
  }

  await ensureWebhookSchema(env)

  // Check for duplicate events (idempotency)
  const isDuplicate = await isEventProcessed(event.id, env)
  if (isDuplicate) {
    console.log(`Webhook event ${event.id} already processed, skipping`)
    return jsonResponse({ received: true, duplicate: true })
  }

  // Process event based on type
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, env)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, env)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, env)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice, env)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, env)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // Mark event as processed
    await markEventProcessed(event, env)

    return jsonResponse({ received: true })
  } catch (error) {
    console.error(`Error processing webhook event ${event.id}:`, error instanceof Error ? error.message : 'Unknown error')
    throw error
  }
}

// Check if event has already been processed
async function isEventProcessed(eventId: string, env: Env): Promise<boolean> {
  const result = await env.DB.prepare('SELECT event_id FROM billing_events WHERE event_id = ?')
    .bind(eventId)
    .first()

  return result !== null
}

// Mark event as processed
async function markEventProcessed(event: Stripe.Event, env: Env): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO billing_events (event_id, event_type, payload) VALUES (?, ?, ?)'
  )
    .bind(event.id, event.type, JSON.stringify(event))
    .run()
}

// Handle checkout.session.completed
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, _env: Env): Promise<void> {
  console.log(`Checkout completed: ${session.id}`)

  if (session.metadata?.flow === 'agent_marketplace_rental') {
    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null
    await markRentalPaidFromCheckout(session.id, paymentIntentId, _env)
    return
  }

  // Extract metadata
  const userId = session.metadata?.userId
  const workspaceId = session.metadata?.workspaceId || (userId ? `ws-${userId}` : undefined)
  const planCode = parsePlanCode(session.metadata?.planCode)
  const interval = parseBillingInterval(session.metadata?.interval)

  if (!workspaceId || !planCode || !interval) {
    throw new BadRequestException('Missing or invalid metadata in checkout session')
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  if (!customerId) {
    throw new BadRequestException('Missing customer in checkout session')
  }

  await _env.DB.prepare(
    `INSERT INTO workspace_billing (workspace_id, stripe_customer_id, plan_code, interval, status, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(workspace_id) DO UPDATE SET
      stripe_customer_id = excluded.stripe_customer_id,
      plan_code = excluded.plan_code,
      interval = excluded.interval,
      status = excluded.status,
      updated_at = excluded.updated_at`,
  )
    .bind(workspaceId, customerId, planCode, interval, 'pending')
    .run()
}

// Handle subscription created/updated
async function handleSubscriptionUpdated(subscription: Stripe.Subscription, env: Env): Promise<void> {
  console.log(`Subscription updated: ${subscription.id}`)

  // Get customer metadata to find user ID
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  // Get user ID from subscription metadata or customer
  const workspaceId = subscription.metadata?.workspaceId || await getWorkspaceIdFromCustomer(customerId, env)
  if (!workspaceId) {
    console.error('Cannot find workspace ID for subscription:', subscription.id)
    return
  }

  // Extract plan information from metadata
  const planCode = parsePlanCode(subscription.metadata?.planCode) || 'STARTER'
  const interval = parseBillingInterval(subscription.metadata?.interval) || 'MONTHLY'

  await env.DB.prepare(
    `INSERT INTO workspace_billing (
      workspace_id, stripe_customer_id, stripe_subscription_id, plan_code, status, interval, current_period_end, cancel_at_period_end, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(workspace_id) DO UPDATE SET
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      plan_code = excluded.plan_code,
      status = excluded.status,
      interval = excluded.interval,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = excluded.updated_at`,
  )
    .bind(
      workspaceId,
      customerId,
      subscription.id,
      planCode,
      subscription.status,
      interval,
      new Date(subscription.current_period_end * 1000).toISOString(),
      subscription.cancel_at_period_end ? 1 : 0,
    )
    .run()
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, env: Env): Promise<void> {
  console.log(`Subscription deleted: ${subscription.id}`)

  await env.DB.prepare(
    `UPDATE workspace_billing
     SET status = 'canceled', updated_at = datetime('now')
     WHERE stripe_subscription_id = ?`
  )
    .bind(subscription.id)
    .run()
}

// Handle invoice paid
async function handleInvoicePaid(invoice: Stripe.Invoice, env: Env): Promise<void> {
  console.log(`Invoice paid: ${invoice.id}`)

  // Get subscription ID from invoice
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id

  if (!subscriptionId) {
    console.error('No subscription ID in invoice:', invoice.id)
    return
  }

  const workspace = await env.DB.prepare(
    'SELECT workspace_id FROM workspace_billing WHERE stripe_subscription_id = ?'
  )
    .bind(subscriptionId)
    .first<{ workspace_id: string }>()

  if (!workspace) {
    console.error('Workspace billing not found for invoice:', invoice.id)
    return
  }

  // Check if invoice already exists
  const existing = await env.DB.prepare(
    'SELECT id FROM invoices WHERE stripe_invoice_id = ?'
  )
    .bind(invoice.id)
    .first()

  if (existing) {
    // Update existing invoice
    await env.DB.prepare(
      `UPDATE invoices
       SET status = ?, amount_paid_usd = ?, hosted_invoice_url = ?, pdf_url = ?
       WHERE stripe_invoice_id = ?`
    )
      .bind(
        invoice.status || 'paid',
        invoice.amount_paid,
        invoice.hosted_invoice_url || null,
        invoice.invoice_pdf || null,
        invoice.id
      )
      .run()
  } else {
    // Create new invoice
    await env.DB.prepare(
      `INSERT INTO invoices (id, workspace_id, stripe_invoice_id, number, amount_paid_usd, currency, status, hosted_invoice_url, pdf_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        workspace.workspace_id,
        invoice.id,
        invoice.number || `INV-${invoice.id}`,
        invoice.amount_paid,
        invoice.currency.toUpperCase(),
        invoice.status || 'paid',
        invoice.hosted_invoice_url || null,
        invoice.invoice_pdf || null
      )
      .run()
  }
}

// Handle invoice payment failed
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, env: Env): Promise<void> {
  console.log(`Invoice payment failed: ${invoice.id}`)

  // Update subscription status
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id

  if (subscriptionId) {
    await env.DB.prepare(
      `UPDATE workspace_billing
       SET status = 'past_due', updated_at = datetime('now')
       WHERE stripe_subscription_id = ?`
    )
      .bind(subscriptionId)
      .run()
  }
}

async function getWorkspaceIdFromCustomer(customerId: string, env: Env): Promise<string | null> {
  const result = await env.DB.prepare(
    'SELECT workspace_id FROM workspace_billing WHERE stripe_customer_id = ? ORDER BY updated_at DESC LIMIT 1'
  )
    .bind(customerId)
    .first<{ workspace_id: string }>()

  return result?.workspace_id || null
}

function parsePlanCode(value: string | undefined): PlanCode | null {
  if (!value) return null
  if (value === 'STARTER' || value === 'DEVELOPER' || value === 'TEAM' || value === 'PRO' || value === 'ENTERPRISE') {
    return value
  }
  return null
}

function parseBillingInterval(value: string | undefined): BillingInterval | null {
  if (!value) return null
  if (value === 'MONTHLY' || value === 'YEARLY') return value
  return null
}
