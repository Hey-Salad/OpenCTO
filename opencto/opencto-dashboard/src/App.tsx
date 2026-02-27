import { useEffect, useMemo, useState } from 'react'
import type { Job, Step } from './types/opencto'
import { JobsListScreen, type JobFilter } from './components/jobs/JobsListScreen'
import { JobDetailStream } from './components/stream/JobDetailStream'
import { MockOpenCtoAdapter } from './mocks/openctoMockAdapter'
import './index.css'

function App() {
  const api = useMemo(() => new MockOpenCtoAdapter(), [])
  const [jobs, setJobs] = useState<Job[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [activeFilter, setActiveFilter] = useState<JobFilter>('ALL')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  useEffect(() => {
    api.listJobs().then((items) => {
      setJobs(items)
      if (items.length > 0) {
        setSelectedJobId(items[0].id)
      }
    })
  }, [api])

  useEffect(() => {
    if (selectedJobId) {
      api.listSteps(selectedJobId).then(setSteps)
    }
  }, [api, selectedJobId])

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null
  const visibleSteps = selectedJobId ? steps : []

  const handleApprove = async (stepId: string) => {
    const updated = await api.approveStep(stepId)
    setSteps((current) => current.map((step) => (step.id === updated.id ? updated : step)))
  }

  const handleDeny = async (stepId: string) => {
    const updated = await api.denyStep(stepId)
    setSteps((current) => current.map((step) => (step.id === updated.id ? updated : step)))
  }

  return (
    <main className="app-shell">
      <header className="top-bar panel">
        <h1>OpenCTO</h1>
        <div className="top-bar-meta">
          <span>JOB OPERATIONS</span>
          <button type="button" className="primary-button">
            New Job
          </button>
        </div>
      </header>

      <aside className="left-sidebar panel" aria-label="Main navigation">
        <button type="button" className="nav-item nav-item-active">
          <span className="nav-icon" />
          Jobs
        </button>
        <button type="button" className="nav-item">
          <span className="nav-icon" />
          Stream
        </button>
        <button type="button" className="nav-item">
          <span className="nav-icon" />
          Compliance
        </button>
        <button type="button" className="nav-item">
          <span className="nav-icon" />
          Metrics
        </button>
        <button type="button" className="nav-item">
          <span className="nav-icon" />
          Settings
        </button>
      </aside>

      <section className="center-column">
        <JobsListScreen
          jobs={jobs}
          activeFilter={activeFilter}
          activeJobId={selectedJobId}
          onFilterChange={setActiveFilter}
          onSelectJob={setSelectedJobId}
        />

        <section className="details-column">
          <header className="panel selected-job-header">
            <h2>{selectedJob?.title ?? 'Select a job'}</h2>
            <p className="muted">{selectedJob?.metadata ?? 'No active session selected.'}</p>
          </header>
          <JobDetailStream steps={visibleSteps} onApprove={handleApprove} onDeny={handleDeny} />
        </section>
      </section>

      <aside className="right-config panel" aria-label="Config panel">
        <h3>Config</h3>
        <label className="config-control">
          <span>Auto-scroll stream</span>
          <input type="checkbox" defaultChecked />
        </label>
        <label className="config-control">
          <span>Show compliance notes</span>
          <input type="checkbox" defaultChecked />
        </label>
        <label className="config-control">
          <span>Compact rows</span>
          <input type="checkbox" />
        </label>
      </aside>
    </main>
  )
}

export default App
