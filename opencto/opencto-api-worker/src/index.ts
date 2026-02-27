// OpenCTO API Worker - Main Entry Point
// Cloudflare Workers backend for OpenCTO dashboard

import type { Env, RequestContext, SessionUser, PlanCode, BillingInterval, ComplianceCheckType } from './types'
import { toJsonResponse, jsonResponse, UnauthorizedException } from './errors'
import * as auth from './auth'
import * as compliance from './compliance'
import * as billing from './billing'
import * as webhooks from './webhooks'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
        },
      })
    }

    try {
      const url = new URL(request.url)
      const path = url.pathname

      // Health check endpoint (no auth required)
      if (path === '/health' || path === '/api/v1/health') {
        return jsonResponse({ status: 'healthy', timestamp: new Date().toISOString() })
      }

      // Webhook endpoint (no auth required, uses signature verification)
      if (path === '/api/v1/billing/webhooks/stripe' && request.method === 'POST') {
        return await webhooks.handleStripeWebhook(request, env)
      }

      // All other endpoints require authentication
      const ctx = await authenticate(request, env)

      // Route to handlers
      return await route(path, request, ctx)
    } catch (error) {
      return toJsonResponse(error)
    }
  },
}

// Authentication middleware
async function authenticate(request: Request, env: Env): Promise<RequestContext> {
  // TODO: Implement proper JWT/session authentication
  // For now, we'll use a stub implementation

  // Get Authorization header
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedException('Missing or invalid authorization header')
  }

  // TODO: Verify JWT token and extract user info
  // const token = authHeader.substring(7) // Remove 'Bearer ' prefix
  // For now, we'll use a stub user
  const user: SessionUser = {
    id: 'user-123',
    email: 'demo@opencto.works',
    displayName: 'Demo User',
    role: 'owner',
  }

  return {
    userId: user.id,
    user,
    env,
  }
}

// Router
async function route(path: string, request: Request, ctx: RequestContext): Promise<Response> {
  const method = request.method

  // Auth endpoints
  if (path === '/api/v1/auth/session' && method === 'GET') {
    return await auth.getSession(ctx)
  }

  if (path === '/api/v1/auth/devices' && method === 'GET') {
    return await auth.getTrustedDevices(ctx)
  }

  if (path.match(/^\/api\/v1\/auth\/devices\/([^/]+)\/revoke$/) && method === 'POST') {
    const deviceId = path.split('/')[5] || ''
    return await auth.revokeDevice(deviceId, ctx)
  }

  if (path === '/api/v1/auth/passkeys' && method === 'GET') {
    return await auth.listPasskeys(ctx)
  }

  if (path === '/api/v1/auth/passkeys/enroll/start' && method === 'POST') {
    return await auth.startPasskeyEnrollment(ctx)
  }

  if (path === '/api/v1/auth/passkeys/enroll/complete' && method === 'POST') {
    const body = await request.json() as { challengeResponse: string }
    return await auth.completePasskeyEnrollment(body.challengeResponse, ctx)
  }

  // Compliance endpoints
  if (path === '/api/v1/compliance/checks' && method === 'POST') {
    const body = await request.json() as { jobId: string; checkType: ComplianceCheckType }
    return await compliance.createComplianceCheck(body, ctx)
  }

  if (path === '/api/v1/compliance/checks' && method === 'GET') {
    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')
    return await compliance.getComplianceChecks(jobId, ctx)
  }

  if (path === '/api/v1/compliance/evidence/export' && method === 'POST') {
    const body = await request.json() as { jobId: string }
    return await compliance.exportEvidencePackage(body.jobId, ctx)
  }

  // Billing endpoints
  if (path === '/api/v1/billing/checkout/session' && method === 'POST') {
    const body = await request.json() as { planCode: string; interval: string }
    return await billing.createCheckoutSession(body.planCode as PlanCode, body.interval as BillingInterval, ctx)
  }

  if (path === '/api/v1/billing/portal/session' && method === 'POST') {
    return await billing.createBillingPortalSession(ctx)
  }

  if (path === '/api/v1/billing/subscription' && method === 'GET') {
    return await billing.getSubscriptionSummary(ctx)
  }

  if (path === '/api/v1/billing/invoices' && method === 'GET') {
    return await billing.getInvoices(ctx)
  }

  // 404 Not Found
  return jsonResponse({ error: 'Not found', code: 'NOT_FOUND' }, 404)
}
