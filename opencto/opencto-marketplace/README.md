# OpenCTO Marketplace Frontend

Standalone static frontend for marketplace flows backed by `api.opencto.works`.

## Local preview

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

Then attach custom domain `market.opencto.works` in Cloudflare Pages project settings.
