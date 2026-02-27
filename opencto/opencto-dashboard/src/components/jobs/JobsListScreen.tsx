import type { Job } from '../../types/opencto'
import { JobRow } from './JobRow'

export type JobFilter = 'ALL' | Job['status']

interface JobsListScreenProps {
  jobs: Job[]
  activeFilter: JobFilter
  activeJobId: string | null
  onFilterChange: (filter: JobFilter) => void
  onSelectJob: (jobId: string) => void
}

const filters: Array<{ label: string; value: JobFilter }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Running', value: 'RUNNING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

export function JobsListScreen({ jobs, activeFilter, activeJobId, onFilterChange, onSelectJob }: JobsListScreenProps) {
  const visibleJobs = activeFilter === 'ALL' ? jobs : jobs.filter((job) => job.status === activeFilter)

  return (
    <section className="panel">
      <header className="jobs-header">
        <div>
          <h1>Jobs</h1>
          <p className="muted">Execution sessions and compliance outcomes</p>
        </div>
        <button type="button" className="primary-button">
          New Job
        </button>
      </header>

      <div className="filter-pills" aria-label="Job filters">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`filter-pill ${activeFilter === filter.value ? 'filter-pill-active' : ''}`}
            onClick={() => onFilterChange(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="job-list" role="list">
        {visibleJobs.map((job) => (
          <JobRow key={job.id} job={job} active={activeJobId === job.id} onSelect={onSelectJob} />
        ))}
      </div>
    </section>
  )
}
