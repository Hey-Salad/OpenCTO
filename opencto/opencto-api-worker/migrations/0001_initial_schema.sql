-- Phase 5 OpenCTO Database Schema
-- Cloudflare D1 (SQLite)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'cto', 'developer', 'viewer', 'auditor')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);

-- Trusted devices table
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('macos', 'ios', 'linux', 'windows')),
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  trust_state TEXT NOT NULL CHECK (trust_state IN ('TRUSTED', 'NEW', 'REVOKED')) DEFAULT 'NEW',
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_trust_state ON devices(trust_state);

-- Passkey credentials table
CREATE TABLE IF NOT EXISTS passkey_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('platform', 'cross-platform')),
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT, -- JSON array of transport types
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_passkey_credentials_user_id ON passkey_credentials(user_id);
CREATE INDEX idx_passkey_credentials_credential_id ON passkey_credentials(credential_id);

-- Passkey enrollment challenges (temporary)
CREATE TABLE IF NOT EXISTS passkey_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_passkey_challenges_user_id ON passkey_challenges(user_id);
CREATE INDEX idx_passkey_challenges_expires_at ON passkey_challenges(expires_at);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('STARTER', 'DEVELOPER', 'TEAM', 'PRO', 'ENTERPRISE')),
  status TEXT NOT NULL,
  interval TEXT NOT NULL CHECK (interval IN ('MONTHLY', 'YEARLY')),
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  number TEXT NOT NULL,
  amount_paid_usd INTEGER NOT NULL, -- stored in cents
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('paid', 'open', 'void', 'uncollectible')),
  hosted_invoice_url TEXT,
  pdf_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- Stripe webhook events (for idempotency)
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  payload TEXT NOT NULL -- JSON blob
);

CREATE INDEX idx_webhook_events_stripe_event_id ON webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);

-- Compliance checks table
CREATE TABLE IF NOT EXISTS compliance_checks (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  check_type TEXT NOT NULL CHECK (check_type IN ('PLAN', 'DIFF', 'DEPLOYMENT', 'INCIDENT')),
  status TEXT NOT NULL CHECK (status IN ('PASS', 'WARN', 'BLOCK', 'ERROR')),
  score INTEGER NOT NULL DEFAULT 0,
  findings TEXT NOT NULL, -- JSON array of findings
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_compliance_checks_job_id ON compliance_checks(job_id);
CREATE INDEX idx_compliance_checks_status ON compliance_checks(status);
CREATE INDEX idx_compliance_checks_checked_at ON compliance_checks(checked_at);

-- Compliance evidence exports table
CREATE TABLE IF NOT EXISTS evidence_exports (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  artifact_url TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_evidence_exports_job_id ON evidence_exports(job_id);
CREATE INDEX idx_evidence_exports_user_id ON evidence_exports(user_id);
CREATE INDEX idx_evidence_exports_expires_at ON evidence_exports(expires_at);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_id TEXT,
  jobs_used INTEGER NOT NULL DEFAULT 0,
  workers_used INTEGER NOT NULL DEFAULT 0,
  users_used INTEGER NOT NULL DEFAULT 0,
  codex_credit_used_usd INTEGER NOT NULL DEFAULT 0, -- stored in cents
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

CREATE INDEX idx_usage_metrics_user_id ON usage_metrics(user_id);
CREATE INDEX idx_usage_metrics_subscription_id ON usage_metrics(subscription_id);
CREATE INDEX idx_usage_metrics_period ON usage_metrics(period_start, period_end);
