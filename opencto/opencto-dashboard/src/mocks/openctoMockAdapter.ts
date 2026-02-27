import type { OpenCtoApi } from '../api/openctoClient'
import type { Job, Step } from '../types/opencto'

const now = new Date().toISOString()

const mockJobs: Job[] = [
  {
    id: 'job-101',
    title: 'Migrate payment webhook retries',
    status: 'RUNNING',
    metadata: 'feature/payments-retry | 7 steps',
    costUsd: 4.23,
    createdAt: now,
    updatedAt: now,
    compliance: {
      status: 'WARN',
      riskClass: 'ELEVATED',
      requiresHumanApproval: false,
      summary: 'Needs policy note update',
    },
  },
  {
    id: 'job-102',
    title: 'Deploy audit retention fix',
    status: 'FAILED',
    metadata: 'hotfix/audit-retention | 3 steps',
    costUsd: 1.71,
    createdAt: now,
    updatedAt: now,
    compliance: {
      status: 'BLOCK',
      riskClass: 'DANGEROUS',
      requiresHumanApproval: true,
      summary: 'Dangerous deploy path',
    },
  },
  {
    id: 'job-103',
    title: 'Generate monthly controls report',
    status: 'COMPLETED',
    metadata: 'ops/compliance-report | 9 steps',
    costUsd: 2.07,
    createdAt: now,
    updatedAt: now,
    compliance: {
      status: 'PASS',
      riskClass: 'SAFE',
      requiresHumanApproval: false,
      summary: 'Controls satisfied',
    },
  },
]

const mockSteps: Record<string, Step[]> = {
  'job-101': [
    {
      id: 'step-1',
      jobId: 'job-101',
      role: 'ORCHESTRATOR',
      message: 'Created plan and assigned worker branch.',
      timestamp: now,
      kind: 'MESSAGE',
    },
    {
      id: 'step-2',
      jobId: 'job-101',
      role: 'CODEX',
      message: 'Patched retry window and added typed backoff guard.',
      timestamp: now,
      kind: 'MESSAGE',
    },
    {
      id: 'step-3',
      jobId: 'job-101',
      role: 'COMPLIANCE',
      message: 'Residual warning: update public policy paragraph.',
      timestamp: now,
      kind: 'MESSAGE',
    },
    {
      id: 'step-4',
      jobId: 'job-101',
      role: 'ASSISTANT',
      message: 'Session ended by orchestrator.',
      timestamp: now,
      kind: 'SESSION_ENDED',
    },
  ],
  'job-102': [
    {
      id: 'step-5',
      jobId: 'job-102',
      role: 'WORKER',
      message: 'Deployment touches production migration route.',
      timestamp: now,
      kind: 'APPROVAL_REQUIRED',
      toolName: 'kubectl apply',
      branchName: 'hotfix/audit-retention',
      compliance: {
        status: 'BLOCK',
        riskClass: 'DANGEROUS',
        requiresHumanApproval: true,
        summary: 'Human approval required before release.',
      },
    },
  ],
  'job-103': [
    {
      id: 'step-6',
      jobId: 'job-103',
      role: 'USER',
      message: 'Generate controls evidence bundle for January.',
      timestamp: now,
      kind: 'MESSAGE',
    },
  ],
}

export class MockOpenCtoAdapter implements OpenCtoApi {
  async listJobs(): Promise<Job[]> {
    return structuredClone(mockJobs)
  }

  async getJob(jobId: string): Promise<Job> {
    const item = mockJobs.find((job) => job.id === jobId)
    if (!item) {
      throw new Error(`Missing mock job: ${jobId}`)
    }
    return structuredClone(item)
  }

  async listSteps(jobId: string): Promise<Step[]> {
    return structuredClone(mockSteps[jobId] ?? [])
  }

  async getStep(stepId: string): Promise<Step> {
    const item = Object.values(mockSteps)
      .flat()
      .find((step) => step.id === stepId)

    if (!item) {
      throw new Error(`Missing mock step: ${stepId}`)
    }

    return structuredClone(item)
  }

  async approveStep(stepId: string): Promise<Step> {
    return this.decide(stepId, 'APPROVE')
  }

  async denyStep(stepId: string): Promise<Step> {
    return this.decide(stepId, 'DENY')
  }

  private async decide(stepId: string, decision: 'APPROVE' | 'DENY'): Promise<Step> {
    const step = await this.getStep(stepId)
    return {
      ...step,
      message: `${step.message} Decision: ${decision}.`,
    }
  }
}
