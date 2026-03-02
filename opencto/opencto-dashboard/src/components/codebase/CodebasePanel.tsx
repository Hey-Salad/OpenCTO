import { useMemo, useState } from 'react'
import type { GitHubConnectionStatus, GitHubOrgSummary, GitHubRepoSummary } from '../../api/githubClient'
import type { CodebaseRun, CodebaseRunEvent } from '../../types/codebaseRuns'

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
  activeRun: CodebaseRun | null
  runEvents: CodebaseRunEvent[]
  runBusy: boolean
  runError: string | null
  defaultRepoUrl: string
  onRunStart: (input: { repoUrl: string; commands: string[] }) => Promise<void>
  onRunCancel: (runId: string) => Promise<void>
  onRunRetry: (run: CodebaseRun) => Promise<void>
}

type CommandPreset = {
  key: string
  label: string
  commands: string[]
}

const COMMAND_PRESETS: CommandPreset[] = [
  { key: 'build', label: 'Build project', commands: ['npm run build'] },
  { key: 'test', label: 'Run tests', commands: ['npm test'] },
  { key: 'install-build', label: 'Install then build', commands: ['npm ci', 'npm run build'] },
  { key: 'install-test', label: 'Install then test', commands: ['npm ci', 'npm test'] },
]

function formatRunStatus(status: CodebaseRun['status']): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
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
  activeRun,
  runEvents,
  runBusy,
  runError,
  defaultRepoUrl,
  onRunStart,
  onRunCancel,
  onRunRetry,
}: CodebasePanelProps) {
  const isConnected = Boolean(status?.connected)
  const connectedUpdated = status?.updatedAt
    ? new Date(status.updatedAt).toLocaleString()
    : 'Not synced yet'

  const [repoUrl, setRepoUrl] = useState(defaultRepoUrl || '')
  const [presetKey, setPresetKey] = useState(COMMAND_PRESETS[0]?.key ?? 'build')

  const selectedPreset = useMemo(
    () => COMMAND_PRESETS.find((preset) => preset.key === presetKey) ?? COMMAND_PRESETS[0],
    [presetKey],
  )

  const handleRun = async () => {
    if (!selectedPreset) return
    await onRunStart({
      repoUrl: repoUrl.trim(),
      commands: selectedPreset.commands,
    })
  }

  return (
    <section className="panel codebase-panel" aria-label="Codebase">
      <header className="codebase-header">
        <div>
          <h2>Codebase</h2>
          <p className="muted">Manage GitHub connections and run coding tasks in isolated executors.</p>
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

      <section className="codebase-run-card" aria-label="Run codebase task">
        <div className="codebase-run-head">
          <h3>Run Task</h3>
          <p className="muted">Start one task at a time with a safe command preset.</p>
        </div>
        <label className="codebase-run-field">
          <span>Repository URL</span>
          <input
            type="url"
            value={repoUrl}
            onChange={(event) => setRepoUrl(event.target.value)}
            placeholder="https://github.com/owner/repo.git"
          />
        </label>
        <label className="codebase-run-field">
          <span>Task preset</span>
          <select value={presetKey} onChange={(event) => setPresetKey(event.target.value)}>
            {COMMAND_PRESETS.map((preset) => (
              <option key={preset.key} value={preset.key}>{preset.label}</option>
            ))}
          </select>
        </label>
        <div className="codebase-run-actions">
          <button
            type="button"
            className="primary-button"
            disabled={runBusy || !repoUrl.trim() || !selectedPreset}
            onClick={() => void handleRun()}
          >
            {runBusy ? 'Starting...' : 'Run Task'}
          </button>
          {activeRun ? (
            <button
              type="button"
              className="secondary-button"
              disabled={runBusy || !['queued', 'running'].includes(activeRun.status)}
              onClick={() => void onRunCancel(activeRun.id)}
            >
              Cancel Run
            </button>
          ) : null}
        </div>
        {runError ? <p className="billing-error">{runError}</p> : null}
      </section>

      <section className="codebase-run-card" aria-label="Run activity">
        <div className="codebase-run-head">
          <h3>Run Activity</h3>
          {activeRun ? <span className={`codebase-run-status codebase-run-status-${activeRun.status}`}>{formatRunStatus(activeRun.status)}</span> : null}
        </div>
        {!activeRun ? (
          <p className="muted">No run started yet.</p>
        ) : (
          <>
            <div className="codebase-run-meta">
              <p><strong>Run ID:</strong> {activeRun.id}</p>
              <p><strong>Repo:</strong> {activeRun.repoUrl}</p>
              <p><strong>Mode:</strong> {activeRun.executionMode}</p>
              <p><strong>Commands:</strong> {activeRun.requestedCommands.join(' → ')}</p>
            </div>
            <div className="codebase-run-actions">
              <button type="button" className="secondary-button" onClick={() => void onRunRetry(activeRun)} disabled={runBusy}>
                Retry Run
              </button>
            </div>
            <div className="codebase-run-events" role="log" aria-live="polite">
              {runEvents.length === 0 ? (
                <p className="muted">Waiting for run events...</p>
              ) : (
                <ul className="plain-list">
                  {runEvents.map((event) => (
                    <li key={`${event.runId}-${event.seq}`} className="list-row codebase-event-row">
                      <div>
                        <p><strong>{event.type}</strong></p>
                        <p>{event.message}</p>
                      </div>
                      <span className="muted">{new Date(event.timestamp).toLocaleTimeString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

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
                  <a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="secondary-button codebase-repo-link">
                    Open
                  </a>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  )
}
