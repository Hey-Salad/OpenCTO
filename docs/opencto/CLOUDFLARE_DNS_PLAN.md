# Cloudflare DNS Plan for `opencto.works`

| Host | Type | Value | TTL | Notes |
| --- | --- | --- | --- | --- |
| `@` | `CNAME` | `opencto-dashboard.hey-salad.workers.dev` | Auto | Landing page root (replace with the canonical Pages or hosting origin). |
| `www` | `CNAME` | `@` | Auto | Redirects www to the root domain via Cloudflare Page Rule or `_redirects`. |
| `app` | `CNAME` | `opencto-dashboard.hey-salad.workers.dev` | Auto | Points to the hosted OpenCTO app assets; `/app` maps to `app.html`. |
| `api` | `CNAME` | `opencto-api.hey-salad.workers.dev` | Auto | If the API surface uses a dedicated worker or backend host, point it here. |
| `txt-challenge` | `TXT` | `opencto-verify=<verification-token>` | Auto | Optional verification record for Cloudflare (Namecheap or other third-party verification). |

> Replace the CNAME targets above with the actual hostnames produced by your static hosting provider (Cloudflare Pages, S3, or another CDN). Keep TTL as `Auto` so Cloudflare can refresh quickly.
