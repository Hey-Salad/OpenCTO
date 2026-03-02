// OpenCTO API Worker - Main Entry Point
// Cloudflare Workers backend for OpenCTO dashboard

import { Container } from '@cloudflare/containers'
import type { Env, RequestContext, SessionUser, PlanCode, BillingInterval, ComplianceCheckType } from './types'
import { toJsonResponse, jsonResponse, UnauthorizedException } from './errors'
import * as auth from './auth'
import * as compliance from './compliance'
import * as billing from './billing'
import * as webhooks from './webhooks'
import * as chats from './chats'
import * as onboarding from './onboarding'
import * as github from './github'
import * as codebaseRuns from './codebaseRuns'

export class CodebaseExecutorContainer extends Container {
  defaultPort = 4000
  sleepAfter = '10m'
}

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

      // OAuth endpoints (no prior auth required)
      if (path === '/api/v1/auth/oauth/github/start' && request.method === 'GET') {
        return await auth.startGitHubOAuth(request, env)
      }
      if (path === '/api/v1/auth/oauth/github/callback' && request.method === 'GET') {
        return await auth.completeGitHubOAuth(request, env)
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
  const authHeader = request.headers.get('Authorization')
  const accessEmail = request.headers.get('CF-Access-Authenticated-User-Email')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

  // Production auth: signed session token from OAuth callback.
  if (bearerToken && bearerToken !== 'demo-token') {
    const sessionUser = await auth.parseSessionToken(bearerToken, env)
    if (sessionUser) {
      return {
        userId: sessionUser.id,
        user: sessionUser,
        env,
      }
    }
  }

  // Development fallback only outside production.
  const hasDemoToken = bearerToken === 'demo-token' && env.ENVIRONMENT !== 'production'
  if (!hasDemoToken && !accessEmail) {
    throw new UnauthorizedException('Missing authorization. Sign in via GitHub OAuth or Cloudflare Access identity.')
  }

  const email = accessEmail ?? 'demo@opencto.works'
  const id = `user-${email.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const user: SessionUser = {
    id,
    email,
    displayName: email.split('@')[0] || 'OpenCTO User',
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

  if (path === '/api/v1/auth/account' && method === 'DELETE') {
    return await auth.deleteAccount(ctx)
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

  // Chat persistence endpoints
  if (path === '/api/v1/chats' && method === 'GET') {
    return await chats.listChats(ctx)
  }

  if (path.match(/^\/api\/v1\/chats\/([^/]+)$/) && method === 'GET') {
    const chatId = path.split('/')[4] ?? ''
    return await chats.getChat(chatId, ctx)
  }

  if (path === '/api/v1/chats/save' && method === 'POST') {
    const body = await request.json() as {
      id?: string
      title?: string
      messages?: Array<{
        id: string
        role: 'USER' | 'ASSISTANT' | 'TOOL'
        kind?: 'speech' | 'code' | 'command' | 'output' | 'artifact' | 'plan'
        text: string
        timestamp: string
        startMs: number
        endMs: number
        metadata?: Record<string, unknown>
      }>
    }
    return await chats.saveChat(body, ctx)
  }

  // Codebase run execution endpoints
  if (path === '/api/v1/codebase/runs' && method === 'POST') {
    const body = await request.json().catch(() => ({})) as {
      repoUrl?: string
      repoFullName?: string
      baseBranch?: string
      targetBranch?: string
      commands?: unknown
      timeoutSeconds?: number
    }
    return await codebaseRuns.createCodebaseRun(body, ctx)
  }

  if (path.match(/^\/api\/v1\/codebase\/runs\/([^/]+)$/) && method === 'GET') {
    const runId = path.split('/')[5] ?? ''
    return await codebaseRuns.getCodebaseRun(runId, ctx)
  }

  if (path.match(/^\/api\/v1\/codebase\/runs\/([^/]+)\/events$/) && method === 'GET') {
    const runId = path.split('/')[5] ?? ''
    return await codebaseRuns.getCodebaseRunEvents(runId, request, ctx)
  }

  if (path.match(/^\/api\/v1\/codebase\/runs\/([^/]+)\/cancel$/) && method === 'POST') {
    const runId = path.split('/')[5] ?? ''
    return await codebaseRuns.cancelCodebaseRun(runId, ctx)
  }

  // Onboarding endpoints
  if (path === '/api/v1/onboarding' && method === 'GET') {
    return await onboarding.getOnboarding(ctx)
  }

  if (path === '/api/v1/onboarding' && method === 'POST') {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    return await onboarding.saveOnboarding(body, ctx)
  }

  // GitHub integration endpoints
  if (path === '/api/v1/github/status' && method === 'GET') {
    return await github.getGitHubStatus(ctx)
  }

  if (path === '/api/v1/github/sync' && method === 'POST') {
    return await github.syncGitHub(ctx)
  }

  if (path === '/api/v1/github/orgs' && method === 'GET') {
    return await github.listGitHubOrgs(ctx)
  }

  if (path === '/api/v1/github/repos' && method === 'GET') {
    const url = new URL(request.url)
    const org = url.searchParams.get('org') ?? ''
    return await github.listGitHubRepos(ctx, org)
  }

  // Realtime token endpoint — mints a short-lived ephemeral key for the browser WebSocket
  if (path === '/api/v1/realtime/token' && method === 'POST') {
    return await mintRealtimeToken(request, ctx)
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

  // CTO agent proxy routes — forward to external APIs using server-side tokens

  if (path === '/api/v1/cto/vercel/projects' && method === 'GET') {
    return await proxyVercel('/v9/projects?limit=20', ctx.env)
  }

  if (path.match(/^\/api\/v1\/cto\/vercel\/projects\/([^/]+)\/deployments$/) && method === 'GET') {
    const projectId = path.split('/')[6] ?? ''
    return await proxyVercel(`/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=10`, ctx.env)
  }

  if (path.match(/^\/api\/v1\/cto\/vercel\/deployments\/([^/]+)$/) && method === 'GET') {
    const deploymentId = path.split('/')[6] ?? ''
    return await proxyVercel(`/v13/deployments/${encodeURIComponent(deploymentId)}`, ctx.env)
  }

  if (path === '/api/v1/cto/cloudflare/workers' && method === 'GET') {
    return await proxyCF(`/client/v4/accounts/${ctx.env.CF_ACCOUNT_ID}/workers/scripts`, ctx.env)
  }

  if (path === '/api/v1/cto/cloudflare/pages' && method === 'GET') {
    return await proxyCF(`/client/v4/accounts/${ctx.env.CF_ACCOUNT_ID}/pages/projects`, ctx.env)
  }

  if (path.match(/^\/api\/v1\/cto\/cloudflare\/workers\/([^/]+)\/usage$/) && method === 'GET') {
    const scriptName = path.split('/')[6] ?? ''
    const now = new Date()
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    return await proxyCF(
      `/client/v4/accounts/${ctx.env.CF_ACCOUNT_ID}/workers/scripts/${encodeURIComponent(scriptName)}/analytics/aggregate?since=${since}`,
      ctx.env,
    )
  }

  if (path === '/api/v1/cto/openai/models' && method === 'GET') {
    return await proxyOpenAI('/v1/models', ctx.env)
  }

  if (path === '/api/v1/cto/openai/usage' && method === 'GET') {
    const url = new URL(request.url)
    const start = url.searchParams.get('start') ?? ''
    const end = url.searchParams.get('end') ?? ''
    return await proxyOpenAI(`/v1/usage?start_time=${start}&end_time=${end}`, ctx.env)
  }

  if (path === '/api/v1/cto/github/orgs' && method === 'GET') {
    return await proxyGitHub('/user/orgs?per_page=50', ctx.env)
  }

  if (path.match(/^\/api\/v1\/cto\/github\/orgs\/([^/]+)\/repos$/) && method === 'GET') {
    const org = path.split('/')[6] ?? ''
    return await proxyGitHub(`/orgs/${encodeURIComponent(org)}/repos?sort=updated&per_page=50`, ctx.env)
  }

  if (path.match(/^\/api\/v1\/cto\/github\/repos\/([^/]+)\/([^/]+)\/pulls$/) && method === 'GET') {
    const owner = path.split('/')[6] ?? ''
    const repo = path.split('/')[7] ?? ''
    return await proxyGitHub(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=all&sort=updated&direction=desc&per_page=20`,
      ctx.env,
    )
  }

  if (path.match(/^\/api\/v1\/cto\/github\/repos\/([^/]+)\/([^/]+)\/actions\/runs$/) && method === 'GET') {
    const owner = path.split('/')[6] ?? ''
    const repo = path.split('/')[7] ?? ''
    return await proxyGitHub(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=20`,
      ctx.env,
    )
  }

  if (path === '/api/v1/cto/github/chat/completions' && method === 'POST') {
    return await proxyGitHubChatCompletions(request, ctx.env)
  }

  if (path === '/api/v1/agent/respond' && method === 'POST') {
    return await proxySupervisorResponse(request, ctx.env)
  }

  // 404 Not Found
  return jsonResponse({ error: 'Not found', code: 'NOT_FOUND' }, 404)
}

// ---------------------------------------------------------------------------
// CTO agent proxy helpers — keep external API tokens server-side
// ---------------------------------------------------------------------------

async function proxyVercel(apiPath: string, env: Env): Promise<Response> {
  if (!env.VERCEL_TOKEN) {
    return jsonResponse({ error: 'VERCEL_TOKEN is not configured', code: 'CONFIG_ERROR' }, 500)
  }
  const res = await fetch(`https://api.vercel.com${apiPath}`, {
    headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` },
  })
  const body = await res.text()
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function proxyCF(apiPath: string, env: Env): Promise<Response> {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return jsonResponse({ error: 'CF_API_TOKEN or CF_ACCOUNT_ID is not configured', code: 'CONFIG_ERROR' }, 500)
  }
  const res = await fetch(`https://api.cloudflare.com${apiPath}`, {
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
  })
  const body = await res.text()
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function proxyOpenAI(apiPath: string, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return jsonResponse({ error: 'OPENAI_API_KEY is not configured', code: 'CONFIG_ERROR' }, 500)
  }
  const res = await fetch(`https://api.openai.com${apiPath}`, {
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
  })
  const body = await res.text()
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function proxyGitHubChatCompletions(request: Request, env: Env): Promise<Response> {
  if (!env.GITHUB_TOKEN) {
    return jsonResponse({ error: 'GITHUB_TOKEN is not configured', code: 'CONFIG_ERROR' }, 500)
  }

  const body = await request.json().catch(() => ({})) as {
    model?: string
    messages?: Array<{ role: string; content: string }>
    max_tokens?: number
    temperature?: number
  }

  if (!body.model || !Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse(
      { error: 'model and messages are required', code: 'BAD_REQUEST' },
      400,
    )
  }

  const payload = {
    model: body.model,
    messages: body.messages,
    max_tokens: body.max_tokens ?? 1024,
    temperature: body.temperature ?? 0.2,
  }

  const res = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const raw = await res.text()
  return new Response(raw, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function proxyGitHub(apiPath: string, env: Env): Promise<Response> {
  if (!env.GITHUB_TOKEN) {
    return jsonResponse({ error: 'GITHUB_TOKEN is not configured', code: 'CONFIG_ERROR' }, 500)
  }

  const res = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'opencto-api-worker',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  const raw = await res.text()
  return new Response(raw, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function proxySupervisorResponse(request: Request, env: Env): Promise<Response> {
  if (!env.OPENCTO_AGENT_BASE_URL) {
    return jsonResponse({ error: 'OPENCTO_AGENT_BASE_URL is not configured', code: 'CONFIG_ERROR' }, 500)
  }

  const body = await request.text()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)

  try {
    const res = await fetch(`${env.OPENCTO_AGENT_BASE_URL}/v1/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      signal: controller.signal,
    })

    const raw = await res.text()
    return new Response(raw, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    return jsonResponse(
      { error: 'Supervisor endpoint unavailable', code: 'UPSTREAM_ERROR', detail: String(error) },
      502,
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function mintRealtimeToken(_request: Request, ctx: RequestContext): Promise<Response> {
  if (!ctx.env.OPENAI_API_KEY) {
    return jsonResponse({ error: 'OPENAI_API_KEY secret is not configured on this Worker', code: 'CONFIG_ERROR' }, 500)
  }

  let rawBody: string
  try {
    // Realtime GA requires client secrets minted from this endpoint.
    const body = await _request.json().catch(() => ({})) as { model?: string }
    const requestedModel = body.model ?? 'gpt-realtime-1.5'
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: 600 },
        session: {
          type: 'realtime',
          model: requestedModel,
        },
      }),
    })
    rawBody = await res.text()

    if (!res.ok) {
      return jsonResponse({ error: 'OpenAI rejected the request', code: 'OPENAI_ERROR', details: rawBody }, res.status)
    }

    const data = JSON.parse(rawBody) as {
      value?: string
      expires_at?: number
      client_secret?: { value?: string; expires_at?: number }
    }
    const secret = data.value ?? data.client_secret?.value
    const expiresAt = data.expires_at ?? data.client_secret?.expires_at

    if (!secret) {
      return jsonResponse({ error: 'Unexpected response shape from OpenAI', raw: data }, 502)
    }

    return jsonResponse({ clientSecret: secret, expiresAt })
  } catch (err) {
    return jsonResponse({ error: 'Fetch to OpenAI failed', detail: String(err) }, 502)
  }
}
