import type { ComplianceApi } from '../api/complianceClient'
import type {
  ComplianceCheck,
  CreateComplianceCheckRequest,
  EvidenceExportResult,
} from '../types/compliance'

const checks: ComplianceCheck[] = [
  {
    id: 'chk-1',
    jobId: 'job-101',
    checkType: 'PLAN',
    status: 'PASS',
    score: 0.97,
    findings: [],
    checkedAt: new Date().toISOString(),
  },
  {
    id: 'chk-2',
    jobId: 'job-102',
    checkType: 'DEPLOYMENT',
    status: 'BLOCK',
    score: 0.41,
    findings: [
      {
        id: 'fd-1',
        framework: 'PCI-DSS',
        reference: 'Req.6.3',
        severity: 'HIGH',
        summary: 'Missing manual approval evidence for dangerous deployment step.',
      },
    ],
    checkedAt: new Date().toISOString(),
  },
]

export class ComplianceMockAdapter implements ComplianceApi {
  async createComplianceCheck(request: CreateComplianceCheckRequest): Promise<ComplianceCheck> {
    const check: ComplianceCheck = {
      id: `chk-${Date.now()}`,
      jobId: request.jobId,
      checkType: request.checkType,
      status: 'WARN',
      score: 0.72,
      findings: [],
      checkedAt: new Date().toISOString(),
    }
    checks.unshift(check)
    return structuredClone(check)
  }

  async getComplianceChecks(jobId?: string): Promise<ComplianceCheck[]> {
    if (!jobId) {
      return structuredClone(checks)
    }
    return structuredClone(checks.filter((item) => item.jobId === jobId))
  }

  async exportEvidencePackage(jobId: string): Promise<EvidenceExportResult> {
    return {
      artifactId: `artifact-${jobId}`,
      downloadUrl: `https://api.opencto.works/mock/evidence/${jobId}.zip`,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }
  }
}
