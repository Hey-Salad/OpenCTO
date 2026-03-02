import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CodebasePanel } from './CodebasePanel'
import type { CodebaseRun } from '../../types/codebaseRuns'

const codebaseRunsMocks = vi.hoisted(() => ({
  createCodebaseRun: vi.fn(),
  getCodebaseRun: vi.fn(),
  getCodebaseRunEvents: vi.fn(),
  cancelCodebaseRun: vi.fn(),
  getCodebaseMetrics: vi.fn(),
  listCodebaseRunArtifacts: vi.fn(),
  streamCodebaseRunEvents: vi.fn(),
}))

vi.mock('../../api/codebaseRunsClient', () => ({
  createCodebaseRun: codebaseRunsMocks.createCodebaseRun,
  getCodebaseRun: codebaseRunsMocks.getCodebaseRun,
  getCodebaseRunEvents: codebaseRunsMocks.getCodebaseRunEvents,
  cancelCodebaseRun: codebaseRunsMocks.cancelCodebaseRun,
  getCodebaseMetrics: codebaseRunsMocks.getCodebaseMetrics,
  listCodebaseRunArtifacts: codebaseRunsMocks.listCodebaseRunArtifacts,
  streamCodebaseRunEvents: codebaseRunsMocks.streamCodebaseRunEvents,
  getCodebaseRunArtifactDownloadUrl: (runId: string, artifactId: string) => `/api/v1/codebase/runs/${runId}/artifacts/${artifactId}`,
}))

function buildRun(id = 'run-1'): CodebaseRun {
  return {
    id,
    userId: 'u1',
    repoUrl: 'https://github.com/Hey-Salad/CTO-AI.git',
    repoFullName: 'Hey-Salad/CTO-AI',
    baseBranch: 'main',
    targetBranch: 'opencto/test',
    status: 'queued',
    requestedCommands: ['npm run build'],
    commandAllowlistVersion: '2026-03-02',
    timeoutSeconds: 600,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    canceledAt: null,
    errorMessage: null,
  }
}

describe('CodebasePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    codebaseRunsMocks.getCodebaseMetrics.mockResolvedValue({
      window: '24h',
      since: new Date().toISOString(),
      totals: { totalRuns: 4, succeededRuns: 3, failedRuns: 1, activeRuns: 0, avgDurationSeconds: 2.5 },
    })
    codebaseRunsMocks.streamCodebaseRunEvents.mockResolvedValue(undefined)
    codebaseRunsMocks.listCodebaseRunArtifacts.mockResolvedValue({ artifacts: [{ id: 'log', runId: 'run-1', kind: 'log', path: 'run-log.txt', createdAt: new Date().toISOString() }] })
  })

  it('renders metrics and allows creating a run', async () => {
    codebaseRunsMocks.createCodebaseRun.mockResolvedValue({ run: buildRun(), allowlist: [] })

    render(
      <CodebasePanel
        status={{ connected: true, login: 'peter', scope: 'repo', updatedAt: new Date().toISOString() }}
        syncMessage={null}
        syncing={false}
        orgs={[]}
        repos={[]}
        selectedOrg=""
        onSelectOrg={vi.fn()}
        onSync={vi.fn(async () => {})}
        onConnect={vi.fn(async () => {})}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('https://github.com/org/repo.git'), {
      target: { value: 'https://github.com/Hey-Salad/CTO-AI.git' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))

    await waitFor(() => {
      expect(codebaseRunsMocks.createCodebaseRun).toHaveBeenCalled()
    })
  })

  it('shows run error when create fails', async () => {
    codebaseRunsMocks.createCodebaseRun.mockRejectedValue(new Error('failed to create'))

    render(
      <CodebasePanel
        status={{ connected: true, login: 'peter', scope: 'repo', updatedAt: new Date().toISOString() }}
        syncMessage={null}
        syncing={false}
        orgs={[]}
        repos={[]}
        selectedOrg=""
        onSelectOrg={vi.fn()}
        onSync={vi.fn(async () => {})}
        onConnect={vi.fn(async () => {})}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('https://github.com/org/repo.git'), {
      target: { value: 'https://github.com/Hey-Salad/CTO-AI.git' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }))

    await waitFor(() => {
      expect(screen.getByText('failed to create')).toBeInTheDocument()
    })
  })
})
