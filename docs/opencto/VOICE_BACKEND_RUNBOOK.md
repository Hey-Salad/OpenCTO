# OpenCTO Voice Backend Runbook

Last verified: 2026-03-02
Host verified: `heysalad-ai-01` (`192.168.1.197`)

## 1) Runtime Topology

- Voice backend app:
  - Service: `opencto-voice-backend.service`
  - Bind: `127.0.0.1:8090`
  - Process: `uvicorn app:app --host 127.0.0.1 --port 8090 --workers 1`
  - Working dir: `/home/hs-chilu/heysalad-ai-projects/opencto-voice-backend`
- Public ingress:
  - Service: `cloudflared.service`
  - Tunnel hostname: `cloud-services-api.opencto.works`
  - Tunnel target: `http://127.0.0.1:8090`

## 2) Source/Layout On Server

- Current deployed backend directory:
  - `/home/hs-chilu/heysalad-ai-projects/opencto-voice-backend`
- Current directory is not a git repository.
- Recommended: clone `CTO-AI` to server and migrate service to repo-managed path after validation.

## 3) Systemd Configuration

Unit file:
- `/etc/systemd/system/opencto-voice-backend.service`

Expected structure:
- `User=hs-chilu`
- `WorkingDirectory=/home/hs-chilu/heysalad-ai-projects/opencto-voice-backend`
- `EnvironmentFile=/etc/opencto-voice-backend.env`
- `ExecStart=/home/hs-chilu/heysalad-ai-projects/opencto-voice-backend/run.sh`
- `Restart=always`

Run script:
- `/home/hs-chilu/heysalad-ai-projects/opencto-voice-backend/run.sh`

## 4) Environment Variables

Configured via:
- `/etc/opencto-voice-backend.env`

Known keys:
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

Rules:
- Do not commit env files.
- Do not print secret values in logs/docs.
- Rotate keys if exposed.

## 5) Cloudflared Configuration

Config file:
- `/home/hs-chilu/.cloudflared/opencto-voice-config.yml`

Expected ingress:
- `hostname: cloud-services-api.opencto.works`
- `service: http://127.0.0.1:8090`

## 6) Operations Commands

Service status:
```bash
sudo systemctl status opencto-voice-backend --no-pager -n 50
sudo systemctl status cloudflared --no-pager -n 50
```

Restart services:
```bash
sudo systemctl restart opencto-voice-backend
sudo systemctl restart cloudflared
```

Tail logs:
```bash
journalctl -u opencto-voice-backend -f
journalctl -u cloudflared -f
```

Port checks:
```bash
ss -ltnp | rg '8090|cloudflared|uvicorn'
```

## 7) Smoke Tests

Local app health:
```bash
curl -sS http://127.0.0.1:8090/health
```

Public health:
```bash
curl -sS https://cloud-services-api.opencto.works/health
```

Local response:
```bash
curl -sS -X POST http://127.0.0.1:8090/v1/respond \
  -H 'Content-Type: application/json' \
  -d '{"text":"Say hello in one line"}'
```

Public response:
```bash
curl -sS -X POST https://cloud-services-api.opencto.works/v1/respond \
  -H 'Content-Type: application/json' \
  -d '{"text":"Say hello in one line"}'
```

## 8) Known Failure Modes

- `500 OPENAI_API_KEY is not configured`
  - Fix: set `OPENAI_API_KEY` in `/etc/opencto-voice-backend.env` and restart service.
- Tunnel domain returns 404
  - Fix: verify cloudflared ingress points to `127.0.0.1:8090` and service is healthy.
- Intermittent QUIC tunnel warnings in cloudflared logs
  - Usually transient; confirm tunnel reconnects and health endpoints remain OK.

## 9) Security Notes

- Cloudflared token is currently visible in the cloudflared systemd process arguments.
- Recommended hardening:
  - Move tunnel token to an environment file with root-only permissions.
  - Rotate tunnel token after migration.
  - Restrict backend CORS to trusted app domains when production traffic stabilizes.

## 10) Migration to Repo-Managed Deployment (Recommended)

1. Clone repo:
```bash
cd /home/hs-chilu/heysalad-ai-projects
git clone git@github.com:Hey-Salad/CTO-AI.git
```
2. Create backend runtime dir from repo source (or update service `WorkingDirectory`).
3. Validate with local health check.
4. Switch systemd `WorkingDirectory` + `ExecStart` to repo-managed path.
5. Restart and re-run smoke tests.
