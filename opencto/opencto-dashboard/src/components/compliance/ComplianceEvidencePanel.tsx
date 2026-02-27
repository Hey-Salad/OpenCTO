import type { ComplianceCheck } from '../../types/compliance'

interface ComplianceEvidencePanelProps {
  checks: ComplianceCheck[]
  loading: boolean
  error: string | null
  exportDisabledReason: string | null
  onExportEvidence: (jobId: string) => void
}

export function ComplianceEvidencePanel({
  checks,
  loading,
  error,
  exportDisabledReason,
  onExportEvidence,
}: ComplianceEvidencePanelProps) {
  return (
    <section className="panel compliance-panel" aria-label="Compliance evidence">
      <header className="settings-header">
        <h2>Compliance Checks</h2>
      </header>

      {error && <p className="billing-error">{error}</p>}

      {loading ? (
        <p className="muted">Loading compliance checks...</p>
      ) : checks.length === 0 ? (
        <p className="muted">No compliance checks available.</p>
      ) : (
        <ul className="plain-list">
          {checks.map((check) => (
            <li key={check.id} className="list-row compliance-row">
              <div>
                <p>{check.checkType} - {check.jobId}</p>
                <p className="muted">Score: {(check.score * 100).toFixed(0)} | {new Date(check.checkedAt).toLocaleString()}</p>
              </div>
              <div className="compliance-actions">
                <span className={`compliance-badge compliance-${check.status.toLowerCase()}`}>{check.status}</span>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onExportEvidence(check.jobId)}
                  disabled={Boolean(exportDisabledReason)}
                  title={exportDisabledReason ?? undefined}
                >
                  Export Evidence
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {exportDisabledReason && <p className="muted">{exportDisabledReason}</p>}
    </section>
  )
}
