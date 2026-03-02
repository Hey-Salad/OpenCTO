import type { Job } from '../../types/opencto'

interface JobRowProps {
  job: Job
  active: boolean
  onSelect: (jobId: string) => void
}

const STATUS_LABEL: Record<Job['status'], string> = {
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
}

export function JobRow({ job, active, onSelect }: JobRowProps) {
  // Parse "feature/payments-retry | 7 steps" into branch + step count
  const [branch, stepCount] = job.metadata.split(' | ')

  return (
    <button
      className={`job-row ${active ? 'job-row-active' : ''}`}
      onClick={() => onSelect(job.id)}
      type="button"
    >
      {/* Status indicator */}
      <div className="job-status-col">
        <span
          className={`job-status-dot ${job.status === 'RUNNING' ? 'job-status-dot-running' : ''}`}
          data-status={job.status.toLowerCase()}
          aria-label={STATUS_LABEL[job.status]}
        />
      </div>

      {/* Title + meta */}
      <div className="job-row-main">
        <p className="job-title">{job.title}</p>
        <div className="job-row-meta-row">
          {branch && <span className="job-branch">{branch.trim()}</span>}
          {stepCount && <span className="job-step-count">{stepCount.trim()}</span>}
        </div>
      </div>

      {/* Right side */}
      <div className="job-row-right">
        <span className={`compliance-badge compliance-${job.compliance.status.toLowerCase()}`}>
          {job.compliance.status}
        </span>
        <span className="job-cost">${job.costUsd.toFixed(2)}</span>
      </div>
    </button>
  )
}
