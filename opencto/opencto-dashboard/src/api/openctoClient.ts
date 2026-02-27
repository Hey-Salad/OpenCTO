import type { Job, Step } from '../types/opencto'

export interface OpenCtoApi {
  listJobs: () => Promise<Job[]>
  getJob: (jobId: string) => Promise<Job>
  listSteps: (jobId: string) => Promise<Step[]>
  getStep: (stepId: string) => Promise<Step>
  approveStep: (stepId: string) => Promise<Step>
  denyStep: (stepId: string) => Promise<Step>
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(`OpenCTO API request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

export class OpenCtoHttpClient implements OpenCtoApi {
  constructor(private readonly baseUrl = 'https://api.opencto.works/api/v1') {}

  listJobs(): Promise<Job[]> {
    return fetchJson<Job[]>(`${this.baseUrl}/jobs`)
  }

  getJob(jobId: string): Promise<Job> {
    return fetchJson<Job>(`${this.baseUrl}/jobs/${jobId}`)
  }

  listSteps(jobId: string): Promise<Step[]> {
    return fetchJson<Step[]>(`${this.baseUrl}/jobs/${jobId}/steps`)
  }

  getStep(stepId: string): Promise<Step> {
    return fetchJson<Step>(`${this.baseUrl}/steps/${stepId}`)
  }

  approveStep(stepId: string): Promise<Step> {
    return fetchJson<Step>(`${this.baseUrl}/steps/${stepId}/approve`, {
      method: 'POST',
      headers: {
        'x-idempotency-key': `${stepId}-approve-${Date.now()}`,
      },
    })
  }

  denyStep(stepId: string): Promise<Step> {
    return fetchJson<Step>(`${this.baseUrl}/steps/${stepId}/deny`, {
      method: 'POST',
      headers: {
        'x-idempotency-key': `${stepId}-deny-${Date.now()}`,
      },
    })
  }
}
