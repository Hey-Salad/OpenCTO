import type { GitHubConnectionStatus, GitHubOrgSummary, GitHubRepoSummary } from '../../api/githubClient'

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
  const isConnected = Boolean(status?.connected)
  const connectedUpdated = status?.updatedAt
    ? new Date(status.updatedAt).toLocaleString()
    : 'Not synced yet'

  return (
    <section className="panel codebase-panel" aria-label="Codebase">
      <header className="codebase-header">
        <div>
          <h2>Codebase</h2>
          <p className="muted">Manage GitHub connections and select repositories for agent tasks.</p>
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
