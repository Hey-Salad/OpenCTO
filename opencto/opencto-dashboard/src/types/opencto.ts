export type JobStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type ComplianceStatus = 'PASS' | 'WARN' | 'BLOCK'
export type RiskClass = 'SAFE' | 'RESTRICTED' | 'ELEVATED' | 'DANGEROUS' | 'CRITICAL'

export type StepRole =
  | 'ORCHESTRATOR'
  | 'COMPLIANCE'
  | 'CODEX'
  | 'WORKER'
  | 'USER'
  | 'ASSISTANT'

export interface Compliance {
  status: ComplianceStatus
  riskClass: RiskClass
  requiresHumanApproval: boolean
  summary: string
}

export interface Job {
  id: string
  title: string
  status: JobStatus
  metadata: string
  costUsd: number
  compliance: Compliance
  createdAt: string
  updatedAt: string
}

export interface Step {
  id: string
  jobId: string
  role: StepRole
  message: string
  timestamp: string
  kind: 'MESSAGE' | 'SESSION_ENDED' | 'APPROVAL_REQUIRED'
  toolName?: string
  branchName?: string
  compliance?: Compliance
}

export interface ApprovalDecision {
  stepId: string
  decision: 'APPROVE' | 'DENY'
}
