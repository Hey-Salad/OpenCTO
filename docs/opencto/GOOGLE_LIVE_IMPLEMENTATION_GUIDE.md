# Google Live Implementation Guide

This guide documents the additive Gemini/Vertex live path now implemented in OpenCTO.

## What Changed

OpenCTO now supports a Google-backed live session path without changing the existing OpenAI realtime setup.

The current behavior is:

- OpenAI realtime continues to use `/api/v1/realtime/token`
- Gemini live uses `/api/v1/google-live/session`
- the dashboard launchpad chooses the transport based on the selected voice model
- Gemini live sessions are routed through `opencto/opencto-google-live-backend`

## Architecture

### Existing OpenAI path

- browser requests an ephemeral realtime token from `opencto-api-worker`
- browser connects directly to OpenAI realtime

### New Google path

- browser requests a signed bootstrap session from `opencto-api-worker`
- worker authenticates the user and returns a short-lived signed `sessionToken`
- browser connects to `opencto-google-live-backend` over WebSocket
- backend verifies the token and opens a Vertex AI Live session using `google-genai`

This keeps Google credentials and Vertex AI access on the server side.

## Files Added or Updated

- `opencto/opencto-api-worker/src/googleLive.ts`
- `opencto/opencto-google-live-backend/`
- dashboard Gemini transport files under `opencto/opencto-dashboard/src/lib/realtime/`

## Worker Configuration

Configure these on `opencto/opencto-api-worker`:

- `GOOGLE_LIVE_BACKEND_URL`
- `GOOGLE_LIVE_SHARED_SECRET`
- `GOOGLE_LIVE_DEFAULT_MODEL`
- `GOOGLE_LIVE_ALLOWED_MODELS`
- `GOOGLE_LIVE_SESSION_TTL_SECONDS` optional
- `RATE_LIMIT_GOOGLE_LIVE_SESSIONS_PER_MINUTE` optional

Example local values:

```env
GOOGLE_LIVE_BACKEND_URL=http://127.0.0.1:8091
GOOGLE_LIVE_SHARED_SECRET=replace-with-shared-secret
GOOGLE_LIVE_DEFAULT_MODEL=gemini-2.5-flash-native-audio-preview-12-2025
GOOGLE_LIVE_ALLOWED_MODELS=gemini-2.5-flash-native-audio-preview-12-2025,gemini-2.5-flash-native-audio-preview-09-2025
```

## Google Backend Configuration

Configure these on `opencto/opencto-google-live-backend`:

- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION`
- `GOOGLE_LIVE_SHARED_SECRET`
- `GOOGLE_LIVE_DEFAULT_MODEL`
- `GOOGLE_LIVE_ALLOWED_MODELS`
- `PORT`

The shared secret must match the Worker value exactly.

## Local Development

### 1. Start the Google live backend

```bash
cd opencto/opencto-google-live-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
./run.sh
```

### 2. Configure and run the Worker

```bash
cd opencto/opencto-api-worker
cp .dev.vars.example .dev.vars
npm ci
npm run dev
```

### 3. Run the dashboard

```bash
cd opencto/opencto-dashboard
npm ci
npm run dev
```

## How To Use It

In the dashboard:

1. Open `Launchpad`
2. Select a `Voice model` under `Voice (Realtime) · Google`
3. Pick an agent profile if needed:
   - `Dispatch Agent`
   - `Repo Agent`
   - `Deploy Agent`
   - `Incident Agent`
4. Start the session

When a Gemini live model is selected, the launchpad automatically uses the Google backend route.

## Cloud Run Deployment

Deploy `opencto-google-live-backend` to Cloud Run with a service account that has Vertex AI permissions.

Example:

```bash
cd opencto/opencto-google-live-backend
gcloud run deploy opencto-google-live \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,GOOGLE_CLOUD_LOCATION=us-central1,GOOGLE_LIVE_SHARED_SECRET=YOUR_SHARED_SECRET
```

Then set the Worker env:

- `GOOGLE_LIVE_BACKEND_URL=https://YOUR_CLOUD_RUN_URL`
- `GOOGLE_LIVE_SHARED_SECRET=YOUR_SHARED_SECRET`

## Security Notes

- no browser-side Google API key is required
- the Worker signs short-lived session tokens
- the backend verifies those tokens before opening Vertex AI sessions
- OpenAI and Google paths remain separate, so the existing OpenAI flow is not disrupted

## Operational Check

Validate these endpoints after deployment:

- Worker: `POST /api/v1/google-live/session`
- Backend: `GET /health`
- Backend: `GET /v1/config`
- Backend WebSocket: `/ws/live`
