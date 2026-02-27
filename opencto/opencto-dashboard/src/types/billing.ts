export type PlanCode = 'STARTER' | 'DEVELOPER' | 'TEAM' | 'PRO' | 'ENTERPRISE'

export interface UsageSnapshot {
  jobsUsed: number
  jobsLimit: number | null
  workersUsed: number
  workersLimit: number | null
  usersUsed: number
  usersLimit: number | null
}

export type EntitlementAction =
  | 'CREATE_JOB'
  | 'APPROVE_DANGEROUS_STEP'
  | 'EXPORT_EVIDENCE_PACKAGE'

export interface EntitlementContext {
  planCode: PlanCode
  usage: UsageSnapshot
}

export interface EntitlementDecision {
  action: EntitlementAction
  allowed: boolean
  warning: string | null
  reason: string | null
}
