// Server-side entitlement enforcement
// This module ensures subscription-based feature access is enforced on the backend

import type { PlanCode, UsageSummary } from './types'
import { ForbiddenException } from './errors'

export type EntitlementAction =
  | 'CREATE_JOB'
  | 'APPROVE_DANGEROUS_STEP'
  | 'EXPORT_EVIDENCE_PACKAGE'

export interface EntitlementDecision {
  allowed: boolean
  warning: string | null
  reason: string | null
}

// Plan limits configuration
const PLAN_LIMITS: Record<PlanCode, {
  jobsLimit: number | null
  workersLimit: number | null
  usersLimit: number | null
  codexCreditLimitUsd: number | null
  features: Set<string>
}> = {
  STARTER: {
    jobsLimit: 10,
    workersLimit: 1,
    usersLimit: 1,
    codexCreditLimitUsd: 10,
    features: new Set(['basic_jobs']),
  },
  DEVELOPER: {
    jobsLimit: 100,
    workersLimit: 3,
    usersLimit: 3,
    codexCreditLimitUsd: 50,
    features: new Set(['basic_jobs', 'dangerous_approvals']),
  },
  TEAM: {
    jobsLimit: 500,
    workersLimit: 10,
    usersLimit: 10,
    codexCreditLimitUsd: 200,
    features: new Set(['basic_jobs', 'dangerous_approvals', 'compliance_export']),
  },
  PRO: {
    jobsLimit: null, // unlimited
    workersLimit: null,
    usersLimit: 25,
    codexCreditLimitUsd: 1000,
    features: new Set(['basic_jobs', 'dangerous_approvals', 'compliance_export', 'priority_support']),
  },
  ENTERPRISE: {
    jobsLimit: null,
    workersLimit: null,
    usersLimit: null,
    codexCreditLimitUsd: null,
    features: new Set(['basic_jobs', 'dangerous_approvals', 'compliance_export', 'priority_support', 'sla', 'custom_integrations']),
  },
}

export function checkEntitlement(
  action: EntitlementAction,
  planCode: PlanCode,
  usage: UsageSummary,
): EntitlementDecision {
  const limits = PLAN_LIMITS[planCode]
  if (!limits) {
    return {
      allowed: false,
      warning: null,
      reason: 'Invalid plan code',
    }
  }

  switch (action) {
    case 'CREATE_JOB': {
      // Check if plan has basic jobs feature
      if (!limits.features.has('basic_jobs')) {
        return {
          allowed: false,
          warning: null,
          reason: 'Plan does not include job creation',
        }
      }

      // Check job limit
      if (limits.jobsLimit !== null && usage.jobsUsed >= limits.jobsLimit) {
        return {
          allowed: false,
          warning: null,
          reason: `Job limit reached (${limits.jobsLimit})`,
        }
      }

      // Warning if approaching limit
      const warning = limits.jobsLimit !== null && usage.jobsUsed >= limits.jobsLimit * 0.8
        ? `Approaching job limit (${usage.jobsUsed}/${limits.jobsLimit})`
        : null

      return {
        allowed: true,
        warning,
        reason: null,
      }
    }

    case 'APPROVE_DANGEROUS_STEP': {
      if (!limits.features.has('dangerous_approvals')) {
        return {
          allowed: false,
          warning: null,
          reason: 'Plan does not include dangerous step approvals. Upgrade to Developer or higher.',
        }
      }

      return {
        allowed: true,
        warning: null,
        reason: null,
      }
    }

    case 'EXPORT_EVIDENCE_PACKAGE': {
      if (!limits.features.has('compliance_export')) {
        return {
          allowed: false,
          warning: null,
          reason: 'Plan does not include compliance evidence export. Upgrade to Team or higher.',
        }
      }

      return {
        allowed: true,
        warning: null,
        reason: null,
      }
    }

    default:
      return {
        allowed: false,
        warning: null,
        reason: 'Unknown action',
      }
  }
}

export function enforceEntitlement(
  action: EntitlementAction,
  planCode: PlanCode,
  usage: UsageSummary,
): void {
  const decision = checkEntitlement(action, planCode, usage)
  if (!decision.allowed) {
    throw new ForbiddenException(
      decision.reason || 'Action not allowed for current plan',
      { action, planCode },
    )
  }
}

export function getPlanLimits(planCode: PlanCode) {
  return PLAN_LIMITS[planCode] || null
}
