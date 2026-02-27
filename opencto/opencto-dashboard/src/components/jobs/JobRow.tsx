import type { Job } from '../../types/opencto'

interface JobRowProps {
  job: Job
  active: boolean
  onSelect: (jobId: string) => void
}

const statusColor: Record<Job['status'], string> = {
  RUNNING: 'var(--status-running)',
  COMPLETED: 'var(--status-success)',
  FAILED: 'var(--status-error)',
  CANCELLED: 'var(--text-muted)',
}

export function JobRow({ job, active, onSelect }: JobRowProps) {
  return (
    <button className={`job-row ${active ? 'job-row-active' : ''}`} onClick={() => onSelect(job.id)} type="button">
      <span className="job-status-dot" style={{ backgroundColor: statusColor[job.status] }} aria-hidden="true" />
      <div className="job-row-main">
        <p className="job-title">{job.title}</p>
        <p className="job-meta">{job.metadata}</p>
      </div>
      <p className={`compliance-badge compliance-${job.compliance.status.toLowerCase()}`}>{job.compliance.status}</p>
      <p className="job-cost">${job.costUsd.toFixed(2)}</p>
    </button>
  )
}
