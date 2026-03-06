# OpenCTO Domain Routing Plan

## Target topology

- `opencto.works` -> Marketing homepage
- `use.opencto.works` -> Campaign landing page (CTA to app)
- `app.opencto.works` -> Product app frontend
- `market.opencto.works` -> Marketplace frontend
- `docs.opencto.works` -> Docs site
- `auth.opencto.works` -> Auth endpoints + future CLI device flow
- `api.opencto.works` -> OpenCTO API Worker

## Cloudflare DNS records

Create records in zone `opencto.works`:

1. `app` CNAME -> your app host (Cloudflare Pages/custom host target)
2. `market` CNAME -> marketplace host target
3. `use` CNAME -> same app/landing host as desired
4. `docs` CNAME -> docs host target
5. `auth` CNAME -> auth service host target
6. `api` CNAME -> `opencto-api-worker.heysalad-o.workers.dev`

Set proxy enabled (orange cloud) for all public records.

## Redirect rules

Recommended:

1. `https://opencto.works/*` -> marketing origin (no redirect)
2. `https://use.opencto.works/app*` -> `https://app.opencto.works/$1` (301)
3. CTA on `use.opencto.works` should point to `https://app.opencto.works`

Optional:

- If you want direct redirect from `use` root:
  - `https://use.opencto.works/*` -> `https://app.opencto.works/$1` (302 for testing, 301 once stable)

## Worker routing

Current Worker deploy target:

- `https://opencto-api-worker.heysalad-o.workers.dev`

Production route should include:

- `api.opencto.works/*`

`wrangler.toml` already has:

```toml
[env.production]
name = "opencto-api"
route = { pattern = "api.opencto.works/*", zone_name = "opencto.works" }
```

Deploy with explicit environment:

```bash
cd opencto/opencto-api-worker
wrangler deploy --env production
```

## App + Billing URL contract

Worker billing now uses `APP_BASE_URL` for Stripe return links:

- Success URL: `${APP_BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel URL: `${APP_BASE_URL}/billing/cancel`
- Billing portal return URL: `${APP_BASE_URL}/billing`

Set in Worker vars:

```toml
[vars]
APP_BASE_URL = "https://app.opencto.works"
MARKETPLACE_BASE_URL = "https://market.opencto.works"
```

## Marketplace URL contract

Worker marketplace flows use `MARKETPLACE_BASE_URL` with fallback to `APP_BASE_URL`:

- Connect onboarding refresh URL: `${MARKETPLACE_BASE_URL}/marketplace/connect/refresh`
- Connect onboarding return URL: `${MARKETPLACE_BASE_URL}/marketplace/connect/complete`
- Rental success URL: `${MARKETPLACE_BASE_URL}/marketplace/rentals/success`
- Rental cancel URL: `${MARKETPLACE_BASE_URL}/marketplace/rentals/cancel`

## Validation checklist

1. `curl https://api.opencto.works/health`
2. Open `https://use.opencto.works` and verify CTA route.
3. Open `https://app.opencto.works` and verify app loads.
4. Open `https://market.opencto.works` and verify marketplace frontend loads.
5. Trigger marketplace checkout and confirm Stripe redirect returns to `market.opencto.works`.
