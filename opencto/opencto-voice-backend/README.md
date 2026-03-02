# OpenCTO Voice Backend

Python/FastAPI backend for OpenCTO voice and run-tracking endpoints.

## Endpoints

- `GET /health`
- `POST /v1/respond`
- `POST /v1/runs`
- `GET /v1/runs/{run_id}`
- `GET /v1/runs/{run_id}/events`
- `POST /v1/runs/{run_id}/steps`
- `POST /v1/runs/{run_id}/artifacts`
- `POST /v1/runs/{run_id}/complete`
- `POST /v1/runs/{run_id}/fail`

## Local Run

```bash
cd opencto/opencto-voice-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
./run.sh
```

## Environment Variables

- `OPENAI_API_KEY` (required)
- `OPENAI_BASE_URL` (default: `https://api.openai.com`)
- `OPENAI_MODEL` (default: `gpt-4.1-mini`)

## Security

- Never commit real `.env` files.
- Keep secrets in server env files or secret managers.
