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
    </main>
  )
}

export default App
