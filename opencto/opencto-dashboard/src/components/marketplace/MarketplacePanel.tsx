import { useEffect, useState } from 'react'
import {
  createConnectedAccount,
  createConnectedAccountOnboardingLink,
  createRentalCheckoutSession,
  listMyRentals,
} from '../../api/marketplaceClient'
import type { AgentRentalContract } from '../../types/marketplace'

function formatUsd(cents: number, currency: string): string {
  const normalized = (currency || 'usd').toUpperCase()
  return `${normalized} ${(cents / 100).toFixed(2)}`
}

export function MarketplacePanel() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [businessName, setBusinessName] = useState('')
  const [country, setCountry] = useState('US')
  const [connectedAccountId, setConnectedAccountId] = useState('')

  const [providerWorkspaceId, setProviderWorkspaceId] = useState('ws-provider-demo')
  const [providerStripeAccountId, setProviderStripeAccountId] = useState('acct_demo_provider')
  const [agentSlug, setAgentSlug] = useState('code-review-pro')
  const [description, setDescription] = useState('Agent rental contract')
  const [amountUsd, setAmountUsd] = useState('49')

  const [rentals, setRentals] = useState<AgentRentalContract[]>([])
  const [rentalsLoading, setRentalsLoading] = useState(false)

  const refreshRentals = async () => {
    setRentalsLoading(true)
    try {
      const response = await listMyRentals()
      setRentals(response.contracts ?? [])
    } catch (nextError) {
      const fallback = nextError instanceof Error ? nextError.message : 'Failed to load rentals'
      setError(fallback)
    } finally {
      setRentalsLoading(false)
    }
  }

  useEffect(() => {
    void refreshRentals()
  }, [])

  const handleCreateConnectedAccount = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await createConnectedAccount({
        businessName: businessName || undefined,
        country: country || undefined,
      })
      setConnectedAccountId(response.stripeAccountId)
      setMessage(`Connected account ready: ${response.stripeAccountId}`)
    } catch (nextError) {
      const fallback = nextError instanceof Error ? nextError.message : 'Failed to create account'
      setError(fallback)
    } finally {
      setBusy(false)
    }
  }

  const handleCreateOnboardingLink = async () => {
    if (!connectedAccountId.trim()) {
      setError('Set a connected account ID first')
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await createConnectedAccountOnboardingLink(connectedAccountId)
      setMessage(`Opening Stripe onboarding for ${response.stripeAccountId}`)
      window.open(response.onboardingUrl, '_blank', 'noopener,noreferrer')
    } catch (nextError) {
      const fallback = nextError instanceof Error ? nextError.message : 'Failed to create onboarding link'
      setError(fallback)
    } finally {
      setBusy(false)
    }
  }

  const handleCreateRentalCheckout = async () => {
    const parsedAmount = Number.parseFloat(amountUsd)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be a positive number')
      return
    }

    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await createRentalCheckoutSession({
        providerWorkspaceId,
        providerStripeAccountId,
        agentSlug,
        description,
        amountUsd: parsedAmount,
        currency: 'usd',
      })
      setMessage(`Checkout session created: ${response.checkoutSessionId}`)
      await refreshRentals()
      if (response.checkoutUrl) {
        window.open(response.checkoutUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (nextError) {
      const fallback = nextError instanceof Error ? nextError.message : 'Failed to create checkout session'
      setError(fallback)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel marketplace-page" aria-label="Marketplace">
      <header className="marketplace-header">
        <div>
          <h2>Marketplace</h2>
          <p className="muted">Manage Stripe Connect onboarding and agent rental checkout contracts.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void refreshRentals()} disabled={rentalsLoading || busy}>
          {rentalsLoading ? 'Refreshing...' : 'Refresh Rentals'}
        </button>
      </header>

      {error && <p className="billing-error">{error}</p>}
      {message && <p className="marketplace-success">{message}</p>}

      <section className="marketplace-grid">
        <article className="marketplace-card">
          <h3>Provider Onboarding</h3>
          <label>
            Business name
            <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="OpenCTO Agent Studio" />
          </label>
          <label>
            Country
            <input value={country} onChange={(event) => setCountry(event.target.value.toUpperCase())} maxLength={2} placeholder="US" />
          </label>
          <button type="button" className="primary-button" onClick={() => void handleCreateConnectedAccount()} disabled={busy}>
            Create Connected Account
          </button>

          <label>
            Connected account ID
            <input value={connectedAccountId} onChange={(event) => setConnectedAccountId(event.target.value)} placeholder="acct_..." />
          </label>
          <button type="button" className="secondary-button" onClick={() => void handleCreateOnboardingLink()} disabled={busy}>
            Create Onboarding Link
          </button>
        </article>

        <article className="marketplace-card">
          <h3>Agent Rental Checkout</h3>
          <label>
            Provider workspace ID
            <input value={providerWorkspaceId} onChange={(event) => setProviderWorkspaceId(event.target.value)} placeholder="ws-provider-123" />
          </label>
          <label>
            Provider Stripe account ID
            <input value={providerStripeAccountId} onChange={(event) => setProviderStripeAccountId(event.target.value)} placeholder="acct_..." />
          </label>
          <label>
            Agent slug
            <input value={agentSlug} onChange={(event) => setAgentSlug(event.target.value)} placeholder="agent-slug" />
          </label>
          <label>
            Description
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What the rental includes" />
          </label>
          <label>
            Amount (USD)
            <input value={amountUsd} onChange={(event) => setAmountUsd(event.target.value)} placeholder="49" />
          </label>
          <button type="button" className="primary-button" onClick={() => void handleCreateRentalCheckout()} disabled={busy}>
            Create Checkout Session
          </button>
        </article>
      </section>

      <section className="marketplace-rentals" aria-label="Rental contracts">
        <h3>My Rental Contracts</h3>
        {rentalsLoading ? (
          <p className="muted">Loading rentals...</p>
        ) : rentals.length === 0 ? (
          <p className="muted">No contracts yet.</p>
        ) : (
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Agent</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rentals.map((rental) => (
                <tr key={rental.id}>
                  <td>{rental.id}</td>
                  <td>{rental.agentSlug}</td>
                  <td>{rental.status}</td>
                  <td>{formatUsd(rental.amountCents, rental.currency)}</td>
                  <td>{new Date(rental.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  )
}
