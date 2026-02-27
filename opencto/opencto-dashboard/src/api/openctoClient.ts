import { normalizeApiError, safeFetchJson } from '../lib/safeError'
import type { Job, Step } from '../types/opencto'

export interface OpenCtoApi {
  listJobs: () => Promise<Job[]>
  getJob: (jobId: string) => Promise<Job>
  listSteps: (jobId: string) => Promise<Step[]>
  getStep: (stepId: string) => Promise<Step>
  approveStep: (stepId: string) => Promise<Step>
  denyStep: (stepId: string) => Promise<Step>
}

export class OpenCtoHttpClient implements OpenCtoApi {
  constructor(private readonly baseUrl = 'https://api.opencto.works/api/v1') {}

  async listJobs(): Promise<Job[]> {
    try {
      return await safeFetchJson<Job[]>(`${this.baseUrl}/jobs`, undefined, 'Failed to load jobs')
    } catch (error) {
      throw normalizeApiError(error, 'Failed to load jobs')
    }
  }

  async getJob(jobId: string): Promise<Job> {
    try {
      return await safeFetchJson<Job>(`${this.baseUrl}/jobs/${jobId}`, undefined, 'Failed to load job')
    } catch (error) {
      throw normalizeApiError(error, 'Failed to load job')
    }
  }

  async listSteps(jobId: string): Promise<Step[]> {
    try {
      return await safeFetchJson<Step[]>(`${this.baseUrl}/jobs/${jobId}/steps`, undefined, 'Failed to load steps')
    } catch (error) {
      throw normalizeApiError(error, 'Failed to load steps')
    }
  }

  async getStep(stepId: string): Promise<Step> {
    try {
      return await safeFetchJson<Step>(`${this.baseUrl}/steps/${stepId}`, undefined, 'Failed to load step')
    } catch (error) {
      throw normalizeApiError(error, 'Failed to load step')
    }
  }

  async approveStep(stepId: string): Promise<Step> {
    try {
      return await safeFetchJson<Step>(
        `${this.baseUrl}/steps/${stepId}/approve`,
        {
          method: 'POST',
          headers: {
            'x-idempotency-key': `${stepId}-approve-${Date.now()}`,
          },
        },
        'Failed to approve step',
      )
    } catch (error) {
      throw normalizeApiError(error, 'Failed to approve step')
    }
  }

  async denyStep(stepId: string): Promise<Step> {
    try {
      return await safeFetchJson<Step>(
        `${this.baseUrl}/steps/${stepId}/deny`,
        {
          method: 'POST',
          headers: {
            'x-idempotency-key': `${stepId}-deny-${Date.now()}`,
          },
        },
        'Failed to deny step',
      )
    } catch (error) {
      throw normalizeApiError(error, 'Failed to deny step')
    }
  }
}
