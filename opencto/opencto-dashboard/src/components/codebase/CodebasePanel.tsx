import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cancelCodebaseRun,
  createCodebaseRun,
  getCodebaseMetrics,
  getCodebaseRun,
  getCodebaseRunArtifactDownloadUrl,
  getCodebaseRunEvents,
  listCodebaseRunArtifacts,
  streamCodebaseRunEvents,
} from '../../api/codebaseRunsClient'
import type { GitHubConnectionStatus, GitHubOrgSummary, GitHubRepoSummary } from '../../api/githubClient'
import type { CodebaseMetrics, CodebaseRun, CodebaseRunArtifact, CodebaseRunEvent } from '../../types/codebaseRuns'

interface CodebasePanelProps {
  status: GitHubConnectionStatus | null
  syncMessage: string | null
  syncing: boolean
  orgs: GitHubOrgSummary[]
  repos: GitHubRepoSummary[]
  selectedOrg: string
  onSelectOrg: (org: string) => void
  onSync: () => Promise<void>
  onConnect: () => Promise<void>
}

const TERMINAL_STATUSES = new Set<CodebaseRun['status']>(['succeeded', 'failed', 'canceled', 'timed_out'])
const INITIAL_POLL_DELAY_MS = 1500
const MAX_POLL_DELAY_MS = 12000

function formatTime(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function upsertRun(list: CodebaseRun[], nextRun: CodebaseRun): CodebaseRun[] {
  const existingIndex = list.findIndex((run) => run.id === nextRun.id)
  if (existingIndex === -1) return [nextRun, ...list]
  const updated = [...list]
  updated[existingIndex] = nextRun
  return updated
}

function runStatusClass(status: CodebaseRun['status']): string {
  if (status === 'succeeded') return 'run-status-succeeded'
  if (status === 'failed') return 'run-status-failed'
  if (status === 'canceled') return 'run-status-canceled'
  if (status === 'timed_out') return 'run-status-timed-out'
  if (status === 'running') return 'run-status-running'
  return 'run-status-queued'
}

export function CodebasePanel({
  status,
  syncMessage,
  syncing,
  orgs,
  repos,
  selectedOrg,
  onSelectOrg,
  onSync,
  onConnect,
}: CodebasePanelProps) {
  const [runs, setRuns] = useState<CodebaseRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [eventsByRunId, setEventsByRunId] = useState<Record<string, CodebaseRunEvent[]>>({})
  const [lastSeqByRunId, setLastSeqByRunId] = useState<Record<string, number>>({})
  const [runError, setRunError] = useState<string | null>(null)
  const [runBusy, setRunBusy] = useState(false)
  const [metrics, setMetrics] = useState<CodebaseMetrics | null>(null)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const [artifactsByRunId, setArtifactsByRunId] = useState<Record<string, CodebaseRunArtifact[]>>({})
  const [repoUrl, setRepoUrl] = useState('')
  const [commands, setCommands] = useState('git clone <repo-url>\nnpm install\nnpm test\nnpm run build')
  const [pollDelayMs, setPollDelayMs] = useState(INITIAL_POLL_DELAY_MS)

  const isConnected = Boolean(status?.connected)
  const connectedUpdated = status?.updatedAt
    ? new Date(status.updatedAt).toLocaleString()
    : 'Not synced yet'

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  )

  const selectedRunEvents = selectedRunId ? (eventsByRunId[selectedRunId] ?? []) : []
  const selectedRunArtifacts = selectedRunId ? (artifactsByRunId[selectedRunId] ?? []) : []

  const loadSelectedRun = useCallback(async (runId: string) => {
    const [{ run }, eventsResponse, artifactsResponse] = await Promise.all([
      getCodebaseRun(runId),
      getCodebaseRunEvents(runId, { afterSeq: 0, limit: 500 }),
      listCodebaseRunArtifacts(runId),
    ])

    setRuns((prev) => upsertRun(prev, run))
    setEventsByRunId((prev) => ({ ...prev, [runId]: eventsResponse.events }))
    setLastSeqByRunId((prev) => ({ ...prev, [runId]: eventsResponse.lastSeq }))
    setArtifactsByRunId((prev) => ({ ...prev, [runId]: artifactsResponse.artifacts }))
  }, [])

  const handleCreateRun = async () => {
    setRunBusy(true)
    setRunError(null)
    try {
      const parsedCommands = commands
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

      const response = await createCodebaseRun({
        repoUrl,
        commands: parsedCommands,
      })
      setRuns((prev) => upsertRun(prev, response.run))
      setSelectedRunId(response.run.id)
      setPollDelayMs(INITIAL_POLL_DELAY_MS)
      const nextMetrics = await getCodebaseMetrics()
      setMetrics(nextMetrics)
      setMetricsError(null)
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Failed to create run')
    } finally {
      setRunBusy(false)
    }
  }

  const handleCancelRun = async (runId: string) => {
    setRunBusy(true)
    setRunError(null)
    try {
      const response = await cancelCodebaseRun(runId)
      setRuns((prev) => upsertRun(prev, response.run))
      const nextMetrics = await getCodebaseMetrics()
      setMetrics(nextMetrics)
      setMetricsError(null)
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Failed to cancel run')
    } finally {
      setRunBusy(false)
    }
  }

  useEffect(() => {
    let canceled = false
    void (async () => {
      try {
        const nextMetrics = await getCodebaseMetrics()
        if (canceled) return
        setMetrics(nextMetrics)
        setMetricsError(null)
      } catch (error) {
        if (canceled) return
        setMetricsError(error instanceof Error ? error.message : 'Failed to load codebase metrics')
      }
    })()

    return () => {
      canceled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedRunId) return
    let canceled = false

    void (async () => {
      try {
        await loadSelectedRun(selectedRunId)
      } catch {
        if (!canceled) setRunError('Failed to load run details')
      }
    })()

    return () => {
      canceled = true
    }
  }, [loadSelectedRun, selectedRunId])

  useEffect(() => {
    if (!selectedRunId || !selectedRun || TERMINAL_STATUSES.has(selectedRun.status)) return

    const abortController = new AbortController()
    let canceled = false

    const startStream = async () => {
      try {
        await streamCodebaseRunEvents(selectedRunId, {
          afterSeq: lastSeqByRunId[selectedRunId] ?? 0,
          signal: abortController.signal,
          onEvents: (events, lastSeq) => {
            if (canceled || events.length === 0) return
            setEventsByRunId((prev) => ({
              ...prev,
              [selectedRunId]: [...(prev[selectedRunId] ?? []), ...events],
            }))
            setLastSeqByRunId((prev) => ({ ...prev, [selectedRunId]: lastSeq }))
          },
          onRun: (run) => {
            if (canceled) return
            setRuns((prev) => upsertRun(prev, run))
          },
          onError: () => {
            if (canceled) return
            setRunError('Live stream disconnected. Falling back to polling.')
          },
        })
      } catch {
        if (canceled) return
        const afterSeq = lastSeqByRunId[selectedRunId] ?? 0
        setRunError('Live stream unavailable. Falling back to polling.')
        try {
          const [runResponse, eventsResponse] = await Promise.all([
            getCodebaseRun(selectedRunId),
            getCodebaseRunEvents(selectedRunId, { afterSeq, limit: 200 }),
          ])
          if (canceled) return
          setRuns((prev) => upsertRun(prev, runResponse.run))
          if (eventsResponse.events.length > 0) {
            setEventsByRunId((prev) => ({
              ...prev,
              [selectedRunId]: [...(prev[selectedRunId] ?? []), ...eventsResponse.events],
            }))
            setLastSeqByRunId((prev) => ({ ...prev, [selectedRunId]: eventsResponse.lastSeq }))
          }
          setPollDelayMs(INITIAL_POLL_DELAY_MS)
        } catch {
          if (canceled) return
          setPollDelayMs((prev) => Math.min(MAX_POLL_DELAY_MS, prev * 2))
        }
      }
    }

    const timer = window.setTimeout(() => {
      void startStream()
    }, pollDelayMs)

    return () => {
      canceled = true
      abortController.abort()
      window.clearTimeout(timer)
    }
  }, [lastSeqByRunId, pollDelayMs, selectedRun, selectedRunId])

  return (
    <section className="panel codebase-panel" aria-label="Codebase">
      <header className="codebase-header">
        <div>
          <h2>Codebase</h2>
          <p className="muted">Manage GitHub connections and queue container-backed codebase runs.</p>
        </div>
        <span className={`codebase-status-badge ${isConnected ? 'codebase-status-connected' : 'codebase-status-disconnected'}`}>
          {isConnected ? 'GitHub Connected' : 'GitHub Not Connected'}
        </span>
      </header>

      <div className="codebase-connection-card">
        {isConnected ? (
          <>
            <p>
              <strong>Connected as:</strong> {status?.login ?? 'GitHub user'}
            </p>
            <p className="muted">Last connection update: {connectedUpdated}</p>
            <button type="button" className="secondary-button codebase-connect-cta" onClick={() => void onSync()} disabled={syncing}>
              {syncing ? 'Syncing GitHub...' : 'Sync GitHub Data'}
            </button>
          </>
        ) : (
          <>
            <p>
              <strong>Connection:</strong> Not connected
            </p>
            <p className="muted">Connect your GitHub account to import organizations, repositories, pull requests, and CI status.</p>
            <button type="button" className="primary-button codebase-connect-cta" onClick={() => void onConnect()}>
              Connect GitHub
            </button>
          </>
        )}
        {syncMessage ? <p className="muted">{syncMessage}</p> : null}
      </div>

      <div className="codebase-grid">
        <article>
          <h3>Organizations</h3>
          {!isConnected ? (
            <p className="muted">Connect GitHub to load organizations.</p>
          ) : orgs.length === 0 ? (
            <p className="muted">No organizations synced yet.</p>
          ) : (
            <ul className="plain-list">
              <li>
                <button
                  type="button"
                  className={`codebase-list-btn ${selectedOrg === '' ? 'codebase-list-btn-active' : ''}`}
                  onClick={() => onSelectOrg('')}
                >
                  All organizations
                </button>
              </li>
              {orgs.map((org) => (
                <li key={org.login}>
                  <button
                    type="button"
                    className={`codebase-list-btn ${selectedOrg === org.login ? 'codebase-list-btn-active' : ''}`}
                    onClick={() => onSelectOrg(org.login)}
                  >
                    {org.login}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article>
          <h3>Repositories</h3>
          {!isConnected ? (
            <p className="muted">Connect GitHub to load repositories.</p>
          ) : repos.length === 0 ? (
            <p className="muted">No repositories available for this selection.</p>
          ) : (
            <ul className="plain-list codebase-repo-list">
              {repos.map((repo) => (
                <li key={repo.fullName} className="list-row">
                  <div>
                    <p>{repo.fullName}</p>
                    <p className="muted">{repo.private ? 'Private' : 'Public'} · {repo.defaultBranch ?? 'main'}</p>
                  </div>
                  <div className="codebase-repo-actions">
                    <button
                      type="button"
                      className="secondary-button codebase-repo-link"
                      onClick={() => setRepoUrl(`https://github.com/${repo.fullName}.git`)}
                    >
                      Use
                    </button>
                    <a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="secondary-button codebase-repo-link">
                      Open
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <section className="codebase-runs-panel">
        <header className="codebase-runs-header">
          <h3>Codebase Runs</h3>
          <p className="muted">Container execution orchestration with live logs and downloadable artifacts.</p>
        </header>

        <div className="codebase-metrics-grid">
          <div className="codebase-metric-card">
            <span className="muted">Total (24h)</span>
            <strong>{metrics?.totals.totalRuns ?? 0}</strong>
          </div>
          <div className="codebase-metric-card">
            <span className="muted">Succeeded</span>
            <strong>{metrics?.totals.succeededRuns ?? 0}</strong>
          </div>
          <div className="codebase-metric-card">
            <span className="muted">Failed</span>
            <strong>{metrics?.totals.failedRuns ?? 0}</strong>
          </div>
          <div className="codebase-metric-card">
            <span className="muted">Avg Duration</span>
            <strong>{metrics?.totals.avgDurationSeconds ?? 0}s</strong>
          </div>
        </div>
        {metricsError ? <p className="billing-error">{metricsError}</p> : null}

        <div className="codebase-run-form">
          <label>
            Repository URL
            <input
              type="text"
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              placeholder="https://github.com/org/repo.git"
            />
          </label>
          <label>
            Commands (one per line)
            <textarea
              value={commands}
              onChange={(event) => setCommands(event.target.value)}
              rows={4}
            />
          </label>
          <div className="codebase-run-actions">
            <button type="button" className="primary-button" disabled={runBusy} onClick={() => void handleCreateRun()}>
              {runBusy ? 'Submitting...' : 'Start Run'}
            </button>
          </div>
        </div>

        {runError ? <p className="billing-error">{runError}</p> : null}

        <div className="codebase-runs-grid">
          <article>
            <h4>Runs</h4>
            {runs.length === 0 ? (
              <div className="codebase-empty-state">
                <p className="muted">No runs yet. Start one to see status and logs.</p>
                <button type="button" className="secondary-button" onClick={() => setRunError(null)}>Retry</button>
              </div>
            ) : (
              <ul className="plain-list codebase-runs-list">
                {runs.map((run) => (
                  <li key={run.id} className={`codebase-run-row ${selectedRunId === run.id ? 'codebase-run-row-active' : ''}`}>
                    <button type="button" className="codebase-run-select" onClick={() => setSelectedRunId(run.id)}>
                      <span>{run.targetBranch}</span>
                      <span className="muted">{formatTime(run.createdAt)}</span>
                      <span className={`run-status-badge ${runStatusClass(run.status)}`}>{run.status}</span>
                    </button>
                    {!TERMINAL_STATUSES.has(run.status) && (
                      <button type="button" className="secondary-button" onClick={() => void handleCancelRun(run.id)} disabled={runBusy}>
                        Cancel
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article>
            <h4>Live Log Panel</h4>
            {!selectedRun ? (
              <p className="muted">Select a run to view streamed events.</p>
            ) : (
              <>
                <p className="muted">Run: {selectedRun.id}</p>
                <p className="muted">Status: {selectedRun.status}</p>
                {selectedRun.errorMessage ? <p className="billing-error">Failure reason: {selectedRun.errorMessage}</p> : null}
                <div className="codebase-run-actions-inline">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      if (!selectedRunId) return
                      void loadSelectedRun(selectedRunId).catch(() => {
                        setRunError('Failed to refresh run details')
                      })
                    }}
                  >
                    Retry
                  </button>
                </div>
                <div className="codebase-log-panel" role="log" aria-live="polite">
                  {selectedRunEvents.length === 0 ? (
                    <p className="muted">No events yet.</p>
                  ) : (
                    <ul className="plain-list codebase-log-lines">
                      {selectedRunEvents.map((event) => (
                        <li key={event.id} className={`codebase-log-line codebase-log-${event.level}`}>
                          <span className="codebase-log-seq">#{event.seq}</span>
                          <span>{event.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="codebase-artifacts">
                  <h5>Artifacts</h5>
                  {selectedRunArtifacts.length === 0 ? (
                    <p className="muted">No artifacts available.</p>
                  ) : (
                    <ul className="plain-list">
                      {selectedRunArtifacts.map((artifact) => (
                        <li key={artifact.id} className="list-row">
                          <div>
                            <p>{artifact.path}</p>
                            <p className="muted">{artifact.kind}</p>
                          </div>
                          <a
                            className="secondary-button codebase-repo-link"
                            href={getCodebaseRunArtifactDownloadUrl(selectedRun.id, artifact.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Download
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </article>
        </div>
      </section>
    </section>
  )
}
