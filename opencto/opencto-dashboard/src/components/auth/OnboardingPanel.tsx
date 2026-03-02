import { useMemo, useState } from 'react'
import type { OnboardingState, SaveOnboardingInput } from '../../types/onboarding'

interface OnboardingPanelProps {
  initialState: OnboardingState | null
  onSubmit: (payload: SaveOnboardingInput) => Promise<void>
}

export function OnboardingPanel({
  initialState,
  onSubmit,
}: OnboardingPanelProps) {
  const [firstName, setFirstName] = useState(initialState?.profile.firstName ?? '')
  const [lastName, setLastName] = useState(initialState?.profile.lastName ?? '')
  const [email, setEmail] = useState(initialState?.profile.email ?? '')
  const [phone, setPhone] = useState(initialState?.profile.phone ?? '')
  const [githubUsername, setGithubUsername] = useState(initialState?.profile.githubUsername ?? '')
  const [companyName, setCompanyName] = useState(initialState?.companyName ?? '')
  const [teamSize, setTeamSize] = useState(initialState?.teamSize ?? '')
  const [acceptTerms, setAcceptTerms] = useState(initialState?.termsAccepted ?? false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(
    () => Boolean(firstName.trim() && lastName.trim() && email.trim() && companyName.trim() && teamSize && acceptTerms),
    [acceptTerms, companyName, email, firstName, lastName, teamSize],
  )

  const handleSubmit = async () => {
    if (!canSubmit || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        githubUsername: githubUsername.trim(),
        companyName: companyName.trim(),
        teamSize: teamSize as SaveOnboardingInput['teamSize'],
        acceptTerms,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save onboarding')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="panel onboarding-panel" aria-label="OpenCTO onboarding">
      <div className="onboarding-header">
        <h2>Welcome to OpenCTO</h2>
        <p className="muted">Complete your workspace profile to enable GitHub organization and project workflows.</p>
      </div>

      <div className="onboarding-grid">
        <label>
          <span>First Name</span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Peter" />
        </label>
        <label>
          <span>Last Name</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Machona" />
        </label>
        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </label>
        <label>
          <span>Phone Number</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0101" />
        </label>
        <label>
          <span>GitHub Username</span>
          <input value={githubUsername} onChange={(e) => setGithubUsername(e.target.value)} placeholder="octocat" />
        </label>
        <label>
          <span>Company</span>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="OpenCTO" />
        </label>
        <label>
          <span>Team Size</span>
          <select value={teamSize} onChange={(e) => setTeamSize(e.target.value as SaveOnboardingInput['teamSize'] | '')}>
            <option value="">Select team size</option>
            <option value="1">Just me</option>
            <option value="2-5">2-5</option>
            <option value="6-20">6-20</option>
            <option value="21-50">21-50</option>
            <option value="51+">51+</option>
          </select>
        </label>
      </div>

      <label className="onboarding-terms">
        <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
        <span>I accept the OpenCTO Terms and Conditions.</span>
      </label>

      {error && <p className="billing-error">{error}</p>}

      <div className="onboarding-actions">
        <button
          type="button"
          className="primary-button"
          onClick={handleSubmit}
          disabled={!canSubmit || isSaving}
        >
          {isSaving ? 'Saving...' : 'Continue to Workspace'}
        </button>
      </div>
    </section>
  )
}
