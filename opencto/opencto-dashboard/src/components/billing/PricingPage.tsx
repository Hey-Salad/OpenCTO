import type { BillingInterval, Plan, PlanCode } from '../../types/billing'

interface PricingPageProps {
  plans: Plan[]
  interval: BillingInterval
  onIntervalChange: (interval: BillingInterval) => void
  onCheckout: (planCode: PlanCode) => void
}

function formatPrice(priceUsd: number | null): string {
  if (priceUsd === null) {
    return 'Contact Sales'
  }

  return `$${priceUsd}`
}

export function PricingPage({ plans, interval, onIntervalChange, onCheckout }: PricingPageProps) {
  return (
    <section className="panel pricing-page">
      <header className="pricing-header">
        <div>
          <h2>Pricing</h2>
          <p className="muted">Choose the plan that fits your engineering governance scope.</p>
        </div>
        <div className="billing-toggle" role="tablist" aria-label="Billing interval">
          <button
            type="button"
            className={`toggle-button ${interval === 'MONTHLY' ? 'toggle-button-active' : ''}`}
            onClick={() => onIntervalChange('MONTHLY')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`toggle-button ${interval === 'YEARLY' ? 'toggle-button-active' : ''}`}
            onClick={() => onIntervalChange('YEARLY')}
          >
            Yearly
          </button>
        </div>
      </header>

      <div className="plans-grid">
        {plans.map((plan) => {
          const price = interval === 'MONTHLY' ? plan.monthlyPriceUsd : plan.yearlyPriceUsd
          return (
            <article key={plan.code} className={`plan-card ${plan.highlighted ? 'plan-card-highlighted' : ''}`}>
              <div className="plan-title-row">
                <h3>{plan.name}</h3>
                {plan.highlighted && <span className="recommended-badge">Recommended</span>}
              </div>
              <p className="muted">{plan.description}</p>
              <p className="plan-price">{formatPrice(price)}</p>
              <p className="plan-period">{price === null ? 'custom terms' : interval === 'MONTHLY' ? 'per month' : 'per year'}</p>
              <p className="plan-credit">Codex credit included: ${plan.includedCodexCreditUsd}</p>

              <ul className="plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <button type="button" className="primary-button" onClick={() => onCheckout(plan.code)}>
                {plan.code === 'ENTERPRISE' ? 'Contact Sales' : 'Start Plan'}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
