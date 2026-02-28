# Web Deployment for `opencto.works`

This document captures the static marketing site and clean routing for the OpenCTO domain.

## Deployment steps
1. In `opencto-dashboard`, run `npm ci` to install dependencies, then `npm run build` to produce the `dist` folder (which copies the files under `public/`).
2. Deploy the `dist` output to your static host (Cloudflare Pages, Netlify, or another CDN) with the following routing expectations:
   - `/` serves `landing.html`.
   - `/press` and `/blog` map directly to their respective marketing pages.
   - `/app` maps to `app.html` so the Launch App CTA resolves without `.html` in the URL.
3. Ensure `_redirects` and `_headers` (in `public/`) are published alongside the HTML so Cloudflare Pages can honor the rules.
4. Confirm that the React dashboard entry (`index.html`) remains untouched; it is available as a direct file if needed but the marketing landing sits on `/`.

## SSL/TLS configuration
- Set Cloudflare SSL/TLS **mode** to **Full (strict)**.
- Use provisioned certificates for every host (`opencto.works`, `www.opencto.works`, `app.opencto.works`, `api.opencto.works`).
- Enable **Always Use HTTPS** and **Automatic HTTPS Rewrites** to keep traffic secure.

## Redirect rules
1. `www.opencto.works` → `https://opencto.works` (set via Cloudflare Page Rule or `_redirects`).
2. `http://` → `https://` (enforced by Cloudflare with Always Use HTTPS).
3. Clean routing via `public/_redirects` ensures `/press`, `/blog`, and `/app` do not expose `.html` extensions.

## Validation checklist
- [ ] DNS propagation shows `opencto.works` resolving through Cloudflare nameservers (use `dig opencto.works +short`).
- [ ] TLS certificate is active for `opencto.works` and `www.opencto.works`, reporting **Full (strict)** and no errors.
- [ ] `/`, `/press`, `/blog`, and `/app` return the correct content without `.html` in the public URL.
- [ ] Redirects honor www → naked domain and HTTP → HTTPS across browsers.
- [ ] The Launch App CTA on each marketing page points to `/app` and responds with the expected page.
