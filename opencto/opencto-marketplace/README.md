# OpenCTO Marketplace Frontend

Standalone static frontend for marketplace provider onboarding and agent rental checkout.

This UI calls marketplace endpoints exposed by `opencto-api-worker`.

## What You Can Do From This UI

- Create Stripe connected accounts for providers
- Create onboarding links for existing connected accounts
- Create rental checkout sessions
- List rental contracts for the current auth context

## Prerequisites

- Running API backend with marketplace routes enabled
- Valid bearer token when API routes require authenticated context

Default API base in the UI: `https://api.opencto.works`

## Local Preview

```bash
cd opencto/opencto-marketplace
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Deploy (Cloudflare Pages)

```bash
cd opencto/opencto-marketplace
wrangler pages deploy . --project-name opencto-marketplace
```

Then map custom domain `market.opencto.works` in Cloudflare Pages settings.

## API Routes Used

- `POST /api/v1/marketplace/connect/accounts`
- `POST /api/v1/marketplace/connect/accounts/:id/onboarding-link`
- `POST /api/v1/marketplace/agent-rentals/checkout/session`
- `GET /api/v1/marketplace/agent-rentals`

## Operator Workflow

1. Set API base URL and bearer token.
2. Create a connected account.
3. Generate onboarding link and complete Stripe onboarding.
4. Create rental checkout session.
5. Confirm contract appears in rental list.

## Troubleshooting

- `401/403` responses: verify bearer token and tenant/workspace context.
- Checkout not opening: confirm Stripe keys/webhook setup in API worker.
- Empty rentals list: verify contracts exist for the authenticated workspace.

## How-To Guides

### How to run local marketplace UI against staging API

1. Start static server (`python3 -m http.server 8080`).
2. Open `http://localhost:8080`.
3. Set `API Base URL` to staging or local API worker URL.
4. Paste a valid bearer token.
5. Run `List My Rentals` to verify auth and API connectivity.

### How to test provider onboarding flow

1. Fill business name and country.
2. Click `Create Connected Account`.
3. Copy/confirm returned connected account ID.
4. Click `Create Onboarding Link` and complete Stripe-hosted onboarding.

### How to test rental checkout flow

1. Fill provider workspace/account and agent details.
2. Click `Create Checkout Session`.
3. Complete checkout in opened Stripe link.
4. Return and run `List My Rentals` to verify contract state.

## References (Chicago 17th, Bibliography)

Cloudflare. n.d. "Cloudflare Pages." Cloudflare Docs. Accessed March 6, 2026. https://developers.cloudflare.com/pages/.

Stripe. n.d. "Connect: Hosted Onboarding." Stripe Docs. Accessed March 6, 2026. https://docs.stripe.com/connect/hosted-onboarding.

Stripe. n.d. "Checkout." Stripe Docs. Accessed March 6, 2026. https://docs.stripe.com/payments/checkout.
