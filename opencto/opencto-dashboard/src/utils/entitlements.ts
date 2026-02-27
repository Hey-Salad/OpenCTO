import type { EntitlementAction, EntitlementContext, EntitlementDecision, PlanCode } from '../types/billing'

interface PlanEntitlement {
  canApproveDangerous: boolean
  canExportEvidence: boolean
}

const entitlementByPlan: Record<PlanCode, PlanEntitlement> = {
  STARTER: { canApproveDangerous: false, canExportEvidence: false },
  DEVELOPER: { canApproveDangerous: false, canExportEvidence: true },
  TEAM: { canApproveDangerous: true, canExportEvidence: true },
  PRO: { canApproveDangerous: true, canExportEvidence: true },
  ENTERPRISE: { canApproveDangerous: true, canExportEvidence: true },
}

function usageWarning(context: EntitlementContext): string | null {
  const { jobsLimit, jobsUsed } = context.usage
  if (jobsLimit === null) {
    return null
  }

  const ratio = jobsUsed / jobsLimit
  if (ratio >= 1) {
    return 'Job limit reached for current billing period.'
  }

  if (ratio >= 0.8) {
    return 'Job usage is above 80 percent of the current plan limit.'
  }

  return null
}

export function evaluateEntitlement(
  context: EntitlementContext,
  action: EntitlementAction,
): EntitlementDecision {
  const plan = entitlementByPlan[context.planCode]
  const warning = usageWarning(context)

  if (action === 'CREATE_JOB') {
    const jobsLimit = context.usage.jobsLimit
    const overLimit = jobsLimit !== null && context.usage.jobsUsed >= jobsLimit
    return {
      action,
      allowed: !overLimit,
      warning,
      reason: overLimit ? 'Upgrade plan or wait for usage reset to create more jobs.' : null,
    }
  }

  if (action === 'APPROVE_DANGEROUS_STEP') {
    return {
      action,
      allowed: plan.canApproveDangerous,
      warning,
      reason: plan.canApproveDangerous ? null : 'Plan does not allow dangerous approval actions.',
    }
  }

  return {
    action,
    allowed: plan.canExportEvidence,
    warning,
    reason: plan.canExportEvidence ? null : 'Evidence export requires Developer plan or higher.',
  }
}
