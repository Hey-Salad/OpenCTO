# OpenCTO CloudBot Worker

Cloudflare Worker that exposes a Telegram webhook and uses OpenAI Responses API.
Now includes KV-backed persistent memory, task tracking, and daily activity logs with lightweight RAG retrieval.

## Setup

1. Install deps:

```bash
npm install
```

2. Create KV namespace and put id in `wrangler.toml`.

3. Set secrets:

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put OPENCTO_SLACK_BOT_TOKEN
wrangler secret put OPENCTO_SLACK_SIGNING_SECRET
```

4. Deploy:

```bash
npm run deploy
```

5. Set Telegram webhook:

```bash
curl "https://api.telegram.org/bot<token>/setWebhook?url=https://<worker-domain>/webhook/telegram"
```

6. Configure Slack Events API webhook:

- Request URL: `https://<worker-domain>/webhook/slack`
- Subscribe to bot events:
  - `app_mention`
  - `message.channels`
  - `message.groups`
  - `message.im`
- Install app to workspace with bot scope: `chat:write`

Optional `wrangler.toml` vars:

```toml
[vars]
OPENCTO_SLACK_ALLOWED_CHANNELS = "C12345,C67890"
```

## Telegram Commands

- `/help`
- `/remember <text>`: save persistent memory
- `/task add <title>`: create a task
- `/task done <task_id>`: complete a task
- `/tasks`: list open tasks
- `/daily`: show today's activity log

All user/bot messages are also logged into a daily activity stream.

## API Endpoints

- `POST /api/log-activity` body: `{ "chatId": number, "type": string, "text": string }`
- `POST /api/tasks` body: `{ "chatId": number, "title": string, "priority": "low|medium|high" }`
- `GET /api/tasks?chatId=<id>&status=open|done`
- `GET /api/activity/daily?chatId=<id>&date=YYYY-MM-DD`

If `OPENCTO_ADMIN_TOKEN` is set, send `x-opencto-admin-token` header on `/api/*`.

## Slack behavior

- Verifies `X-Slack-Signature` and timestamp (replay-protected).
- Responds to `@OpenCTO` mentions and DMs.
- Starts a thread when mentioned in a channel.
- Continues replying inside that active thread without requiring repeated `@` mentions.
- Replies in thread and reuses the same persistent memory/tasks/RAG context.

## Notes

- This is still intentionally lightweight (KV + lexical retrieval) so it stays fast and cheap.
- For stronger RAG, add embeddings + vector index (Cloudflare Vectorize, pgvector, Pinecone).
