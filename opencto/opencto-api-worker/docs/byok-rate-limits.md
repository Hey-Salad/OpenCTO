# BYOK and Rate Limits (v1)

## BYOK endpoints

Authenticated endpoints:

- `GET /api/v1/llm/keys?workspaceId=<id>`
- `PUT /api/v1/llm/keys/:provider`
- `DELETE /api/v1/llm/keys/:provider?workspaceId=<id>`

`PUT` body:

```json
{
  "apiKey": "<provider-secret>",
  "workspaceId": "default"
}
```

Notes:

- Keys are stored per `user + workspace + provider`.
- Keys are encrypted at rest using AES-GCM with a key derived from `JWT_SECRET` and user identity.
- API responses never return raw secrets (only masked key hints).

## Provider resolution order

For OpenAI and GitHub chat-completions proxy paths, server-side key resolution is:

1. BYOK key for `(user, workspace, provider)`
2. Worker env fallback (`OPENAI_API_KEY` / `GITHUB_TOKEN`)

## Rate limits (D1-backed fixed window)

Applied limits:

- Realtime token minting: `realtime_token`
- Generic CTO proxy routes: `cto_proxy`
- OpenAI CTO proxy routes: `cto_openai_proxy`
- GitHub chat-completions proxy: `cto_github_chat`

Default limits are per minute and configurable via env:

- `RATE_LIMIT_REALTIME_PER_MINUTE` (default `30`)
- `RATE_LIMIT_CTO_PROXY_PER_MINUTE` (default `120`)
- `RATE_LIMIT_CTO_OPENAI_PER_MINUTE` (default `90`)
- `RATE_LIMIT_CTO_GITHUB_CHAT_PER_MINUTE` (default `60`)

When exceeded, API returns `429` with `QUOTA_EXCEEDED` and retry metadata.
