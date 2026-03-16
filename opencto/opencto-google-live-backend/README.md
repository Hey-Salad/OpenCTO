# OpenCTO Google Live Backend

FastAPI WebSocket backend for OpenCTO's Gemini/Vertex live sessions.

## Purpose

This service owns the Google Gen AI SDK connection so the dashboard no longer needs a browser-side Google API key.

It is designed to sit behind the OpenCTO API Worker:

- `opencto-api-worker` authenticates the user and mints a signed short-lived session token
- this backend verifies that token
- the backend opens a Vertex AI Live session using `google-genai`
- the existing OpenCTO launchpad UI streams audio/text to this service over WebSocket

## Endpoints

- `GET /health`
- `GET /v1/config`
- `WS /ws/live?session_token=...`

## Local Run

```bash
cd opencto/opencto-google-live-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
./run.sh
```

## Required Environment

- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_LIVE_SHARED_SECRET`

## Optional Environment

- `GOOGLE_CLOUD_LOCATION` default `us-central1`
- `GOOGLE_LIVE_DEFAULT_MODEL`
- `GOOGLE_LIVE_ALLOWED_MODELS`
- `PORT`

## Production

Deploy this service to Google Cloud Run with a service account that has Vertex AI access.
