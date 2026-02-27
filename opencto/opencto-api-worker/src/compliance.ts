// Compliance handlers for OpenCTO API
// Implements compliance checks and evidence export

import type {
  RequestContext,
  ComplianceCheck,
  CreateComplianceCheckRequest,
  EvidenceExportResult,
  UsageSummary,
  PlanCode,
  BillingInterval,
} from './types'
import { jsonResponse, BadRequestException } from './errors'
import { enforceEntitlement } from './entitlements'

// POST /api/v1/compliance/checks
export async function createComplianceCheck(
  request: CreateComplianceCheckRequest,
  ctx: RequestContext
): Promise<Response> {
  const { env } = ctx

  // Validate request
  if (!request.jobId || !request.checkType) {
    throw new BadRequestException('Missing required fields: jobId, checkType')
  }

  // Generate compliance check ID
  const checkId = crypto.randomUUID()
  const checkedAt = new Date().toISOString()

  // In a real implementation, you would run actual compliance checks here
  // For now, we'll create a stub implementation with sample findings
  const findings = [
    {
      id: crypto.randomUUID(),
      framework: 'SOC2' as const,
      reference: 'CC6.1',
      severity: 'LOW' as const,
      summary: 'Code review required before deployment',
    },
  ]

  const status = 'PASS' as const
  const score = 95

  // Store compliance check in database
  await env.DB.prepare(
    'INSERT INTO compliance_checks (id, job_id, check_type, status, score, findings, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(
      checkId,
      request.jobId,
      request.checkType,
      status,
      score,
      JSON.stringify(findings),
      checkedAt
    )
    .run()

  const check: ComplianceCheck = {
    id: checkId,
    jobId: request.jobId,
    checkType: request.checkType,
    status,
    score,
    findings,
    checkedAt,
  }

  return jsonResponse(check, 201)
}

// GET /api/v1/compliance/checks
export async function getComplianceChecks(
  jobId: string | null,
  ctx: RequestContext
): Promise<Response> {
  const { env } = ctx

  let query = 'SELECT id, job_id, check_type, status, score, findings, checked_at FROM compliance_checks'
  const params: string[] = []

  if (jobId) {
    query += ' WHERE job_id = ?'
    params.push(jobId)
  }

  query += ' ORDER BY checked_at DESC LIMIT 100'

  const result = await env.DB.prepare(query)
    .bind(...params)
    .all<{
      id: string
      job_id: string
      check_type: string
      status: string
      score: number
      findings: string
      checked_at: string
    }>()

  const checks: ComplianceCheck[] = (result.results || []).map((row) => ({
    id: row.id,
    jobId: row.job_id,
    checkType: row.check_type as ComplianceCheck['checkType'],
    status: row.status as ComplianceCheck['status'],
    score: row.score,
    findings: JSON.parse(row.findings),
    checkedAt: row.checked_at,
  }))

  return jsonResponse(checks)
}

// POST /api/v1/compliance/evidence/export
export async function exportEvidencePackage(
  jobId: string,
  ctx: RequestContext
): Promise<Response> {
  const { user, env } = ctx

  // Get user's subscription and usage to check entitlements
  const usage = await getUserUsage(user.id, env)
  const subscription = await getUserSubscription(user.id, env)

  if (!subscription) {
    // Enforce entitlement - requires Team plan or higher
    enforceEntitlement('EXPORT_EVIDENCE_PACKAGE', 'STARTER', usage)
  } else {
    enforceEntitlement('EXPORT_EVIDENCE_PACKAGE', subscription.planCode, usage)
  }

  // Validate job exists
  if (!jobId) {
    throw new BadRequestException('Missing required field: jobId')
  }

  // Generate evidence export
  const artifactId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours

  // In a real implementation, you would:
  // 1. Fetch all compliance checks for the job
  // 2. Generate a PDF or ZIP package with all evidence
  // 3. Upload to R2 storage
  // 4. Generate a signed URL with expiry

  // For now, we'll create a stub URL
  const downloadUrl = `https://evidence.opencto.works/exports/${artifactId}.zip`

  // Store export record
  await env.DB.prepare(
    'INSERT INTO evidence_exports (id, job_id, user_id, artifact_url, expires_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(artifactId, jobId, user.id, downloadUrl, expiresAt)
    .run()

  const result: EvidenceExportResult = {
    artifactId,
    downloadUrl,
    expiresAt,
  }

  return jsonResponse(result)
}

// Helper function to get user usage
async function getUserUsage(userId: string, env: RequestContext['env']): Promise<UsageSummary> {
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

  if (!result) {
    // Return default usage if no record exists
    return {
      jobsUsed: 0,
      jobsLimit: 10,
      workersUsed: 0,
      workersLimit: 1,
      usersUsed: 1,
      usersLimit: 1,
      codexCreditUsedUsd: 0,
      codexCreditLimitUsd: 10,
    }
  }

  return {
    jobsUsed: result.jobs_used,
    jobsLimit: 10, // Will be updated based on plan
    workersUsed: result.workers_used,
    workersLimit: 1,
    usersUsed: result.users_used,
    usersLimit: 1,
    codexCreditUsedUsd: result.codex_credit_used_usd / 100, // Convert from cents
    codexCreditLimitUsd: 10,
  }
}

// Helper function to get user subscription
async function getUserSubscription(userId: string, env: RequestContext['env']) {
  const result = await env.DB.prepare(
    'SELECT id, customer_id, plan_code, status, interval, current_period_start, current_period_end, cancel_at_period_end FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
  )
    .bind(userId)
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

  if (!result) {
    return null
  }

  return {
    id: result.id,
    customerId: result.customer_id,
    planCode: result.plan_code as PlanCode,
    status: result.status,
    interval: result.interval as BillingInterval,
    currentPeriodStart: result.current_period_start,
    currentPeriodEnd: result.current_period_end,
    cancelAtPeriodEnd: result.cancel_at_period_end === 1,
  }
}
