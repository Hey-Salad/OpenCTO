# OpenCTO Realtime Voice Agent — Codex Task

## Goal

Fix the voice agent so that:
1. When the user speaks, their words appear as a transcript in the UI
2. The agent speaks back (audio plays through the browser speakers)
3. The agent can call tools (Vercel, Cloudflare, OpenAI APIs) and speak the results

---

## Repository Layout

```
CTO-AI/
├── opencto/
│   ├── opencto-dashboard/          # React + Vite frontend (browser)
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── ctoAgent.ts     ← MAIN FILE TO FIX (currently broken)
│   │   │   │   └── realtimeClient.ts  ← OLD working raw WS client (reference)
│   │   │   ├── components/
│   │   │   │   └── audio/
│   │   │   │       ├── AudioRealtimeView.tsx   ← UI component (uses ctoAgent.ts)
│   │   │   │       └── AudioConfigPanel.tsx    ← Config panel (voice, model, VAD)
│   │   │   └── index.css           ← Styles (audio-* classes)
│   │   ├── .env.local              ← VITE_API_BASE_URL=https://opencto-api-worker.heysalad-o.workers.dev
│   │   └── package.json            ← has @openai/agents-realtime, zod installed
│   │
│   └── opencto-api-worker/         # Cloudflare Worker backend
│       ├── src/
│       │   ├── index.ts            ← HTTP router + token endpoint + proxy routes
│       │   └── types.ts            ← Env interface (all secret names)
│       └── wrangler.toml           ← Worker config
│
└── docs/opencto/
    └── REALTIME_AGENT_CODEX_TASK.md  ← this file
```

---

## How the Feature Is Supposed to Work

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (opencto-dashboard)                                     │
│                                                                  │
│  1. User clicks Play → handleStartSession()                      │
│  2. Browser POSTs to /api/v1/realtime/token (our CF Worker)      │
│  3. Worker calls OpenAI POST /v1/realtime/sessions               │
│       → returns { client_secret: { value: "ek_...", ... } }      │
│  4. Worker returns { clientSecret: "ek_..." } to browser         │
│  5. Browser opens WebSocket:                                     │
│       wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview │
│       subprotocols: ["realtime", "openai-insecure-api-key.ek_..."]│
│  6. On WS open → browser sends session.update (voice, VAD, etc.) │
│  7. User clicks mic → browser captures PCM16 audio via Worklet   │
│  8. Browser sends input_audio_buffer.append { audio: base64 }    │
│  9. OpenAI detects end of speech (VAD) → sends response          │
│  10. Browser receives response.audio.delta → plays PCM16 audio   │
│  11. Browser receives transcripts → shows in UI                  │
│  12. If agent calls a tool:                                      │
│       a. Browser receives response.function_call_arguments.done  │
│       b. Browser calls /api/v1/cto/vercel|cloudflare|openai/*    │
│       c. Worker proxies to real API using server-side tokens      │
│       d. Browser sends conversation.item.create (function result) │
│       e. Browser sends response.create                           │
│       f. Agent speaks the result                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current State of Each File

### `opencto-dashboard/src/lib/ctoAgent.ts` — BROKEN, replace entirely

This file currently uses the `@openai/agents-realtime` SDK to create a
`RealtimeSession`. The SDK adds 3 layers of abstraction between the browser
and the WebSocket. The result:

- The session config (voice, VAD, transcription model) uses the SDK's internal
  camelCase format (`audio.input.transcription`) which is different from both
  the raw OpenAI API format AND the deprecated camelCase SDK fields — so the
  session is starting with wrong/default config.
- The `audio` events from the SDK may carry data in a format we don't know
  without reading deep SDK source — so playback may be receiving garbage.
- Error messages come back as `[object Object]` because the SDK wraps errors
  in plain objects.
- There is no way to inspect what `session.update` message the SDK actually
  sends, making debugging impossible.

**The fix:** Delete the SDK approach. Replace `ctoAgent.ts` with a direct
raw WebSocket implementation that:
1. Opens `wss://api.openai.com/v1/realtime` directly (same as `realtimeClient.ts`)
2. Sends a correct `session.update` on open
3. Captures PCM16 mic audio and sends `input_audio_buffer.append`
4. Receives `response.audio.delta` base64 chunks and plays them
5. Manually handles the tool-calling loop (30 lines, not a library)

### `opencto-dashboard/src/lib/realtimeClient.ts` — REFERENCE (do not delete)

This is the original raw WebSocket client. It already has:
- Correct PCM16 AudioWorklet capture pipeline
- Correct base64 → PCM16 → Float32 → WebAudio playback pipeline
- Correct WebSocket subprotocol auth (`openai-insecure-api-key.{ek_...}`)
- Correct event handling for transcripts

It does NOT have: tool calling. That is the only thing to add.

### `opencto-dashboard/src/components/audio/AudioRealtimeView.tsx`

The UI component. It was updated to import from `ctoAgent.ts` and expects these
events:

```ts
type AgentEvent =
  | { type: 'session_started' }
  | { type: 'session_ended' }
  | { type: 'user_transcript'; text: string }
  | { type: 'assistant_transcript_done'; text: string }
  | { type: 'tool_start'; toolName: string }
  | { type: 'tool_end'; toolName: string }
  | { type: 'error'; message: string }
```

It calls these methods on `CTOAgentSession`:
- `connect()` → async, establishes WS
- `disconnect()` → tears down
- `startMicrophone()` → async, captures mic
- `stopMicrophone()` → stops mic
- `sendText(text: string)` → sends text message

The `AudioMessage` type used in the messages array has `role: 'USER' | 'ASSISTANT' | 'TOOL'`.

**This file does NOT need changes** as long as `ctoAgent.ts` exports the same
`CTOAgentSession` class and `AgentEvent` type.

### `opencto-dashboard/src/components/audio/AudioConfigPanel.tsx`

Provides the `AudioConfig` shape that gets passed into `CTOAgentSession`:

```ts
interface AudioConfig {
  systemInstructions: string
  voice: string            // "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse"
  turnDetection: boolean   // if true: server_vad; if false: no VAD (manual)
  threshold: number        // 0.0–1.0, VAD threshold
  prefixPadding: number    // ms, how much audio to include before speech
  silenceDuration: number  // ms, how long silence before VAD fires
  model: string            // e.g. "gpt-4o-realtime-preview"
  transcriptModel: string  // "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe"
  maxTokens: number        // max response tokens
  noiseReduction: boolean  // not yet wired to API
  idleTimeout: boolean     // not yet wired to API
}
```

### `opencto-api-worker/src/index.ts` — WORKING, do not change

The Cloudflare Worker backend. Relevant endpoints:

**Token endpoint** (already working):
```
POST /api/v1/realtime/token
Authorization: Bearer demo-token
Body: { "model": "gpt-4o-realtime-preview" }

→ Calls POST https://api.openai.com/v1/realtime/sessions
→ Returns { clientSecret: "ek_...", expiresAt: 1234567890 }
```

**Tool proxy endpoints** (already wired, need VERCEL_TOKEN / CF_API_TOKEN / CF_ACCOUNT_ID secrets set):
```
GET /api/v1/cto/vercel/projects
GET /api/v1/cto/vercel/projects/:id/deployments
GET /api/v1/cto/vercel/deployments/:id
GET /api/v1/cto/cloudflare/workers
GET /api/v1/cto/cloudflare/pages
GET /api/v1/cto/cloudflare/workers/:name/usage
GET /api/v1/cto/openai/models
GET /api/v1/cto/openai/usage?start=YYYY-MM-DD&end=YYYY-MM-DD
```

All proxy routes require `Authorization: Bearer demo-token` (stub auth).

---

## The Fix: Rewrite `ctoAgent.ts` as a Raw WebSocket Client

### Exact session.update message the OpenAI Realtime API expects

```json
{
  "type": "session.update",
  "session": {
    "type": "realtime",
    "modalities": ["text", "audio"],
    "instructions": "<systemInstructions from config>",
    "voice": "<voice from config>",
    "input_audio_format": "pcm16",
    "output_audio_format": "pcm16",
    "input_audio_transcription": {
      "model": "<transcriptModel from config>"
    },
    "turn_detection": {
      "type": "server_vad",
      "threshold": <threshold>,
      "prefix_padding_ms": <prefixPadding>,
      "silence_duration_ms": <silenceDuration>,
      "create_response": true
    },
    "tools": [
      {
        "type": "function",
        "name": "list_vercel_projects",
        "description": "List all Vercel projects in this account",
        "parameters": { "type": "object", "properties": {}, "required": [] }
      },
      {
        "type": "function",
        "name": "list_vercel_deployments",
        "description": "List the most recent deployments for a Vercel project",
        "parameters": {
          "type": "object",
          "properties": {
            "projectId": { "type": "string", "description": "Vercel project name or ID" }
          },
          "required": ["projectId"]
        }
      },
      {
        "type": "function",
        "name": "get_vercel_deployment",
        "description": "Get details and status of a specific Vercel deployment",
        "parameters": {
          "type": "object",
          "properties": {
            "deploymentId": { "type": "string", "description": "Vercel deployment ID (dpl_...)" }
          },
          "required": ["deploymentId"]
        }
      },
      {
        "type": "function",
        "name": "list_cloudflare_workers",
        "description": "List all Cloudflare Workers scripts in the account",
        "parameters": { "type": "object", "properties": {}, "required": [] }
      },
      {
        "type": "function",
        "name": "list_cloudflare_pages",
        "description": "List all Cloudflare Pages projects",
        "parameters": { "type": "object", "properties": {}, "required": [] }
      },
      {
        "type": "function",
        "name": "get_cloudflare_worker_usage",
        "description": "Get CPU time and request metrics for a specific Cloudflare Worker",
        "parameters": {
          "type": "object",
          "properties": {
            "scriptName": { "type": "string", "description": "Cloudflare Worker script name" }
          },
          "required": ["scriptName"]
        }
      },
      {
        "type": "function",
        "name": "list_openai_models",
        "description": "List all available OpenAI models",
        "parameters": { "type": "object", "properties": {}, "required": [] }
      },
      {
        "type": "function",
        "name": "get_openai_usage",
        "description": "Get OpenAI API usage and token costs for a date range",
        "parameters": {
          "type": "object",
          "properties": {
            "startDate": { "type": "string", "description": "Start date YYYY-MM-DD" },
            "endDate":   { "type": "string", "description": "End date YYYY-MM-DD" }
          },
          "required": ["startDate", "endDate"]
        }
      }
    ],
    "tool_choice": "auto",
    "max_response_output_tokens": <maxTokens>
  }
}
```

Notes:
- `"type": "realtime"` inside `session` is **required** for GA models
- `turn_detection` can be `null` to disable VAD (when `config.turnDetection === false`)
- `input_audio_format` and `output_audio_format` must both be `"pcm16"`

### WebSocket connection

```
URL:  wss://api.openai.com/v1/realtime?model=<model>
Subprotocols: ["realtime", "openai-insecure-api-key.<clientSecret>"]
```

The `clientSecret` is the `ek_...` string returned by the token endpoint.

### Audio input pipeline (already works in realtimeClient.ts, copy it)

```
getUserMedia({ audio: true })
  → AudioContext(24000 Hz)
  → AudioWorkletNode("pcm-capture-processor")
  → workletNode.port.onmessage = (e) => {
       // e.data is ArrayBuffer of Int16 PCM16 samples
       send({ type: "input_audio_buffer.append", audio: arrayBufferToBase64(e.data) })
     }
```

The worklet code (inline Blob) converts Float32 mic samples → Int16 PCM16:
```js
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0]
    if (channel?.length) {
      const pcm16 = new Int16Array(channel.length)
      for (let i = 0; i < channel.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, channel[i] * 32768))
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer])
    }
    return true
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor)
```

### Audio output pipeline (already works in realtimeClient.ts, copy it)

When the server sends `response.audio.delta`, the `delta` field is base64 PCM16:

```
base64 string → Uint8Array → Int16Array (PCM16) → Float32Array (/32768)
  → AudioContext.createBuffer(1 channel, 24000 Hz)
  → source.connect(destination)
  → source.start(nextPlaybackTime)   // schedule back-to-back to avoid clicks
```

### Tool calling loop (NEW — does not exist in realtimeClient.ts)

When the server sends `response.output_item.done` with an item of type
`function_call`, or when `response.function_call_arguments.done` fires:

```
Server → { type: "response.function_call_arguments.done",
           call_id: "call_abc",
           name: "list_vercel_projects",
           arguments: "{}" }

Browser → executes the tool (calls our CF Worker proxy)
Browser → sends { type: "conversation.item.create",
                   item: { type: "function_call_output",
                            call_id: "call_abc",
                            output: "<JSON string result>" } }
Browser → sends { type: "response.create", response: {} }
```

### Server events to handle

| Event type | What to do |
|---|---|
| `session.created` | Log it; optionally send session.update here instead of on ws.onopen |
| `session.updated` | Log it |
| `conversation.item.input_audio_transcription.completed` | Emit `user_transcript` event with `event.transcript` |
| `response.audio_transcript.delta` | Accumulate into assistantBuffer |
| `response.audio_transcript.done` | Emit `assistant_transcript_done` with accumulated buffer; reset buffer |
| `response.audio.delta` | Decode base64 PCM16 and schedule playback |
| `response.audio.done` | Nothing needed |
| `response.function_call_arguments.done` | Execute the named tool, send result, trigger response.create |
| `response.done` | Nothing needed |
| `error` | Emit `error` event with `event.error.message` |

### Tool execution mapping

When `response.function_call_arguments.done` fires with `name`, dispatch to:

| `name` | Worker endpoint | How to call |
|---|---|---|
| `list_vercel_projects` | `GET /api/v1/cto/vercel/projects` | no args |
| `list_vercel_deployments` | `GET /api/v1/cto/vercel/projects/{projectId}/deployments` | args.projectId |
| `get_vercel_deployment` | `GET /api/v1/cto/vercel/deployments/{deploymentId}` | args.deploymentId |
| `list_cloudflare_workers` | `GET /api/v1/cto/cloudflare/workers` | no args |
| `list_cloudflare_pages` | `GET /api/v1/cto/cloudflare/pages` | no args |
| `get_cloudflare_worker_usage` | `GET /api/v1/cto/cloudflare/workers/{scriptName}/usage` | args.scriptName |
| `list_openai_models` | `GET /api/v1/cto/openai/models` | no args |
| `get_openai_usage` | `GET /api/v1/cto/openai/usage?start={startDate}&end={endDate}` | args.startDate, args.endDate |

All requests need header: `Authorization: Bearer demo-token`

The base URL comes from `import.meta.env.VITE_API_BASE_URL` (set in `.env.local`).

---

## Implementation Instructions for Codex

### Step 1 — Delete `ctoAgent.ts` and rewrite it from scratch

The new file must:

1. **NOT import `@openai/agents-realtime` or `zod`** — use raw WebSocket only
2. Export the **exact same public API** that `AudioRealtimeView.tsx` expects:
   - `export type AgentEvent = ...` (the union shown above)
   - `export interface CTOAgentConfig { ... }` (same shape as `RealtimeSessionConfig` in current file)
   - `export class CTOAgentSession` with methods:
     - `constructor(tokenUrl: string, config: CTOAgentConfig, onEvent: (ev: AgentEvent) => void)`
     - `async connect(): Promise<void>`
     - `disconnect(): void`
     - `async startMicrophone(): Promise<void>`
     - `stopMicrophone(): void`
     - `sendText(text: string): void`

3. Inside `connect()`:
   - Fetch `{ clientSecret }` from `tokenUrl` with `POST`, `Authorization: Bearer demo-token`, body `{ model }`
   - Open WebSocket to `wss://api.openai.com/v1/realtime?model=<model>` with subprotocols `["realtime", "openai-insecure-api-key.<clientSecret>"]`
   - On `ws.onopen` → send `session.update` with full config (see exact JSON above)
   - Create `playbackCtx = new AudioContext({ sampleRate: 24000 })` inside `connect()` (must be inside user gesture handler)
   - On `ws.onmessage` → parse JSON → call `_handleServerEvent()`
   - On `ws.onerror` → emit `error` event
   - On `ws.onclose` → emit `session_ended`
   - Emit `session_started` on open
   - The `connect()` promise should resolve after the WebSocket is open (not after a round trip)

4. Inside `_handleServerEvent(event)`:
   - Log every event: `console.log('[Agent]', event.type, event)`
   - Handle all events from the table above
   - For tool calls: call `_executeTool(name, callId, args)` which:
     - Emits `tool_start`
     - Calls the correct worker proxy endpoint
     - Sends `conversation.item.create` with `function_call_output`
     - Sends `response.create`
     - Emits `tool_end`

5. Copy `arrayBufferToBase64()`, `_schedulePlayback()`, `startMicrophone()`, `stopMicrophone()` verbatim from `realtimeClient.ts` — these are known-working.

### Step 2 — Do NOT modify `AudioRealtimeView.tsx`

The UI is correct. It only needs `ctoAgent.ts` to work.

### Step 3 — Do NOT modify the API worker

The worker is correct. All proxy endpoints and the token endpoint are working.

### Step 4 — Validate

```bash
cd opencto/opencto-dashboard
npm run lint
npm run build
npm run test
```

All must pass with 0 errors.

---

## Acceptance Criteria

1. `npm run build` passes with no TypeScript errors
2. Opening the Launchpad page and selecting **GPT-4o Realtime** in the model panel, then pressing the play button connects without showing a "Connection error"
3. Clicking the microphone button, speaking a sentence, then releasing → the spoken text appears as a USER message in the conversation
4. The agent speaks back within 2–3 seconds → ASSISTANT message appears with the transcript
5. Saying "list my Vercel projects" → a TOOL message row appears saying "Calling List Vercel Projects…", then updates to "List Vercel Projects done", then the agent speaks the project list
6. `console.log('[Agent]', ...)` shows all raw WebSocket events in DevTools

---

## Environment Variables

`.env.local` (already set, do not change):
```
VITE_API_BASE_URL=https://opencto-api-worker.heysalad-o.workers.dev
```

Cloudflare Worker secrets (set separately with `wrangler secret put`):
```
OPENAI_API_KEY   ← already set on the deployed worker
VERCEL_TOKEN     ← set this for Vercel tool calls to work
CF_API_TOKEN     ← set this for Cloudflare tool calls to work
CF_ACCOUNT_ID    ← set this for Cloudflare tool calls to work
```

---

## Key Reference: `realtimeClient.ts` (working base — copy audio logic from here)

Location: `opencto/opencto-dashboard/src/lib/realtimeClient.ts`

This file has correct implementations of:
- `PCM_WORKLET_CODE` string (AudioWorklet for mic capture)
- `arrayBufferToBase64(buffer: ArrayBuffer): string`
- `startMicrophone(): Promise<void>` — full AudioContext + Worklet setup
- `stopMicrophone(): void`
- `_playAudioChunk(b64Audio: string): Promise<void>` — note: this takes base64, but the new `_schedulePlayback` should take `ArrayBuffer` directly since the server sends base64 which we decode to ArrayBuffer ourselves

The only things it is missing (which `ctoAgent.ts` must add):
1. Tool definitions in `session.update` (send them in the `tools` array)
2. Handling `response.function_call_arguments.done` to execute tools
3. Emitting `tool_start` / `tool_end` events

---

## Why Not Use `@openai/agents-realtime` SDK?

The SDK uses its own internal session config format that differs from the raw
OpenAI API. When we pass `config: { modalities, input_audio_transcription, ... }`
(raw API names), the SDK silently ignores unknown fields because it expects its
own camelCase or nested format. The SDK also wraps errors in plain objects that
serialize to `[object Object]`. For a browser-side voice agent, the raw WebSocket
approach gives full control, full observability, and zero ambiguity. The SDK
is better suited for server-side multi-agent orchestration (Node.js / Cloudflare
Durable Objects) which is a future improvement.
