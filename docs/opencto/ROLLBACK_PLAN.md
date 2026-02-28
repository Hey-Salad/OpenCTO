# Rollback Plan for `opencto.works`

## When to trigger
Use this rollback plan if a DNS cutover, TLS deployment, or release introduces a critical issue that cannot be resolved quickly. Roll back DNS and deployment artifacts before the cutover widens impact.

## Namecheap & Cloudflare adjustments
1. In Namecheap, revert the nameservers back to the previous provider (if instructed) or re-point the custom DNS entries to the prior Cloudflare CNAME targets.
2. In Cloudflare, edit the `@`, `www`, `app`, and `api` records to match the previous known-good hostnames or IP addresses. Document the prior values before editing.
3. Save and monitor `dig` to confirm the nameserver or DNS target reverts.

## Disable latest deploy
1. In your hosting platform (Cloudflare Pages, worker, or CDN), disable or rollback the latest deployment for `opencto.works`.
2. If a Canary or preview environment exists, re-promote the last stable build.
3. Confirm the hosting platform shows the prior revision hash and that `/` now serves the expected landing page.

## Restore previous revision
1. If the rollback requires code changes, check out the previously known-good commit in `opencto-dashboard` and rebuild (`npm ci && npm run build`).
2. Redeploy the freshly built artifacts to the host and ensure `/app`, `/press`, and `/blog` reflect the stable content.
3. Re-run the validation checklist from `WEB_DEPLOYMENT.md` to confirm DNS, TLS, and route behavior before labeling the incident resolved.

## Communication & follow-up
- Notify stakeholders that the rollback is complete, cite the timing, and any impact on Raspberry Pi nodes or Cloudflare DNS.
- Record the lesson in the deployment notes so the next launch can avoid the same failure mode.
