import { normalizeApiError, safeFetchJson } from '../lib/safeError'
import { getApiBaseUrl } from '../config/apiBase'
import type {
  ComplianceCheck,
  CreateComplianceCheckRequest,
  EvidenceExportResult,
} from '../types/compliance'

export interface ComplianceApi {
  createComplianceCheck: (request: CreateComplianceCheckRequest) => Promise<ComplianceCheck>
  getComplianceChecks: (jobId?: string) => Promise<ComplianceCheck[]>
  exportEvidencePackage: (jobId: string) => Promise<EvidenceExportResult>
}

const DEFAULT_API_BASE = `${getApiBaseUrl()}/api/v1`

export class ComplianceHttpClient implements ComplianceApi {
  constructor(private readonly baseUrl = DEFAULT_API_BASE) {}

  async createComplianceCheck(request: CreateComplianceCheckRequest): Promise<ComplianceCheck> {
    try {
      return await safeFetchJson<ComplianceCheck>(
        `${this.baseUrl}/compliance/checks`,
        {
          method: 'POST',
          body: JSON.stringify(request),
          headers: {
            'x-idempotency-key': `compliance-check-${request.jobId}-${Date.now()}`,
          },
        },
        'Failed to create compliance check',
      )
    } catch (error) {
      throw normalizeApiError(error, 'Failed to create compliance check')
    }
  }

  async getComplianceChecks(jobId?: string): Promise<ComplianceCheck[]> {
    try {
      const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''
      return await safeFetchJson<ComplianceCheck[]>(
        `${this.baseUrl}/compliance/checks${query}`,
        undefined,
        'Failed to load compliance checks',
      )
    } catch (error) {
      throw normalizeApiError(error, 'Failed to load compliance checks')
    }
  }

  async exportEvidencePackage(jobId: string): Promise<EvidenceExportResult> {
    try {
      return await safeFetchJson<EvidenceExportResult>(
        `${this.baseUrl}/compliance/evidence/export`,
        {
          method: 'POST',
          body: JSON.stringify({ jobId }),
          headers: {
            'x-idempotency-key': `evidence-export-${jobId}-${Date.now()}`,
          },
        },
        'Failed to export evidence package',
      )
    } catch (error) {
      throw normalizeApiError(error, 'Failed to export evidence package')
    }
  }
}
