# Stripe MCP + CLI Setup

This project now supports Stripe MCP in Codex config:

- `~/.codex/config.toml`
- `[mcp_servers.stripe]`
- `url = "https://mcp.stripe.com"`

## 1) Restart Codex

After MCP config changes, restart Codex so Stripe MCP is loaded.

## 2) Stripe CLI login

```bash
stripe login
```

If browser auth is blocked:

```bash
stripe login --interactive
```

## 3) Confirm Worker secrets

```bash
cd opencto/opencto-api-worker
wrangler secret list
```

Required:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## 4) Webhook endpoint

Use this endpoint in Stripe Dashboard:

`https://opencto-api-worker.heysalad-o.workers.dev/api/v1/billing/webhooks/stripe`

Recommended events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

## 5) Local webhook forwarding (optional)

```bash
stripe listen --forward-to https://opencto-api-worker.heysalad-o.workers.dev/api/v1/billing/webhooks/stripe
```

Copy the emitted `whsec_...` and set:

```bash
cd opencto/opencto-api-worker
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler deploy
```

## 6) Trigger Stripe test events

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.paid
```

## 7) Verify billing API

```bash
curl -sS -H 'Authorization: Bearer demo-token' \
  https://opencto-api-worker.heysalad-o.workers.dev/api/v1/billing/subscription
```
