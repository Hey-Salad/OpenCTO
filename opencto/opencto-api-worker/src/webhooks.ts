// Stripe webhook handler with signature verification and idempotency
// SECURITY: Always verify webhook signatures to prevent spoofing

import Stripe from 'stripe'
import type { Env, PlanCode, BillingInterval } from './types'
import { jsonResponse, BadRequestException } from './errors'

// Initialize Stripe client
function getStripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-04-10',
    httpClient: Stripe.createFetchHttpClient(),
  })
}

// POST /api/v1/billing/webhooks/stripe
export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  // Get raw body for signature verification
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    throw new BadRequestException('Missing stripe-signature header')
  }

  const stripe = getStripeClient(env)

  // Verify webhook signature
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err instanceof Error ? err.message : 'Unknown error')
    throw new BadRequestException('Invalid webhook signature')
  }

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
  const result = await env.DB.prepare('SELECT id FROM webhook_events WHERE stripe_event_id = ?')
    .bind(eventId)
    .first()

  return result !== null
}

// Mark event as processed
async function markEventProcessed(event: Stripe.Event, env: Env): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO webhook_events (id, stripe_event_id, event_type, payload) VALUES (?, ?, ?, ?)'
  )
    .bind(crypto.randomUUID(), event.id, event.type, JSON.stringify(event))
    .run()
}

// Handle checkout.session.completed
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, _env: Env): Promise<void> {
  console.log(`Checkout completed: ${session.id}`)

  // Extract metadata
  const userId = session.metadata?.userId
  const planCode = session.metadata?.planCode as PlanCode
  const interval = session.metadata?.interval as BillingInterval

  if (!userId || !planCode || !interval) {
    console.error('Missing metadata in checkout session:', session.id)
    return
  }

  // Subscription will be created by subscription.created event
  // This event is mainly for tracking and analytics
}

// Handle subscription created/updated
async function handleSubscriptionUpdated(subscription: Stripe.Subscription, env: Env): Promise<void> {
  console.log(`Subscription updated: ${subscription.id}`)

  // Get customer metadata to find user ID
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  // Get user ID from subscription metadata or customer
  const userId = subscription.metadata?.userId || await getUserIdFromCustomer(customerId, env)
  if (!userId) {
    console.error('Cannot find user ID for subscription:', subscription.id)
    return
  }

  // Extract plan information from metadata
  const planCode = (subscription.metadata?.planCode as PlanCode) || 'STARTER'
  const interval = (subscription.metadata?.interval as BillingInterval) || 'MONTHLY'

  // Check if subscription already exists
  const existing = await env.DB.prepare(
    'SELECT id FROM subscriptions WHERE stripe_subscription_id = ?'
  )
    .bind(subscription.id)
    .first<{ id: string }>()

  if (existing) {
    // Update existing subscription
    await env.DB.prepare(
      `UPDATE subscriptions
       SET plan_code = ?, status = ?, interval = ?, current_period_start = ?, current_period_end = ?, cancel_at_period_end = ?, updated_at = datetime('now')
       WHERE stripe_subscription_id = ?`
    )
      .bind(
        planCode,
        subscription.status,
        interval,
        new Date(subscription.current_period_start * 1000).toISOString(),
        new Date(subscription.current_period_end * 1000).toISOString(),
        subscription.cancel_at_period_end ? 1 : 0,
        subscription.id
      )
      .run()
  } else {
    // Create new subscription
    await env.DB.prepare(
      `INSERT INTO subscriptions (id, customer_id, user_id, stripe_subscription_id, plan_code, status, interval, current_period_start, current_period_end, cancel_at_period_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        customerId,
        userId,
        subscription.id,
        planCode,
        subscription.status,
        interval,
        new Date(subscription.current_period_start * 1000).toISOString(),
        new Date(subscription.current_period_end * 1000).toISOString(),
        subscription.cancel_at_period_end ? 1 : 0
      )
      .run()
  }
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, env: Env): Promise<void> {
  console.log(`Subscription deleted: ${subscription.id}`)

  await env.DB.prepare(
    `UPDATE subscriptions
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

  // Get internal subscription ID
  const subscription = await env.DB.prepare(
    'SELECT id FROM subscriptions WHERE stripe_subscription_id = ?'
  )
    .bind(subscriptionId)
    .first<{ id: string }>()

  if (!subscription) {
    console.error('Subscription not found for invoice:', invoice.id)
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
      `INSERT INTO invoices (id, subscription_id, stripe_invoice_id, number, amount_paid_usd, currency, status, hosted_invoice_url, pdf_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        subscription.id,
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
      `UPDATE subscriptions
       SET status = 'past_due', updated_at = datetime('now')
       WHERE stripe_subscription_id = ?`
    )
      .bind(subscriptionId)
      .run()
  }
}

// Helper function to get user ID from customer
async function getUserIdFromCustomer(customerId: string, env: Env): Promise<string | null> {
  const result = await env.DB.prepare(
    'SELECT user_id FROM subscriptions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1'
  )
    .bind(customerId)
    .first<{ user_id: string }>()

  return result?.user_id || null
}
