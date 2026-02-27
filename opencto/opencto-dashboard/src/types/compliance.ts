export type ComplianceCheckStatus = 'PASS' | 'WARN' | 'BLOCK' | 'ERROR'

export interface ComplianceFinding {
  id: string
  framework: 'SOC2' | 'DORA' | 'NIS2' | 'GDPR' | 'PCI-DSS'
  reference: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  summary: string
}

export interface ComplianceCheck {
  id: string
  jobId: string
  checkType: 'PLAN' | 'DIFF' | 'DEPLOYMENT' | 'INCIDENT'
  status: ComplianceCheckStatus
  score: number
  findings: ComplianceFinding[]
  checkedAt: string
}

export interface CreateComplianceCheckRequest {
  jobId: string
  checkType: ComplianceCheck['checkType']
}

export interface EvidenceExportResult {
  artifactId: string
  downloadUrl: string
  expiresAt: string
}
