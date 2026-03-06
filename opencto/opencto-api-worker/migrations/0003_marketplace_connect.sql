-- Agent marketplace + Stripe Connect foundation

CREATE TABLE IF NOT EXISTS marketplace_connected_accounts (
  workspace_id TEXT PRIMARY KEY,
  stripe_account_id TEXT NOT NULL UNIQUE,
  business_name TEXT,
  country TEXT,
  charges_enabled INTEGER NOT NULL DEFAULT 0,
  payouts_enabled INTEGER NOT NULL DEFAULT 0,
  details_submitted INTEGER NOT NULL DEFAULT 0,
  onboarding_complete_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_rental_contracts (
  id TEXT PRIMARY KEY,
  renter_workspace_id TEXT NOT NULL,
  provider_workspace_id TEXT NOT NULL,
  provider_stripe_account_id TEXT NOT NULL,
  agent_slug TEXT NOT NULL,
  description TEXT,
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_rental_contracts_renter_created
  ON agent_rental_contracts (renter_workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_rental_contracts_provider_created
  ON agent_rental_contracts (provider_workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_rental_contracts_checkout_session
  ON agent_rental_contracts (stripe_checkout_session_id);
