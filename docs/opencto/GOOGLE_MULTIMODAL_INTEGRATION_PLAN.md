# Google Multimodal Integration Plan for OpenCTO

## Goal

Add a Google-powered realtime multimodal pathway to OpenCTO that supports:

- low-latency bidirectional voice and video sessions
- tool-enabled agents with ADK
- optional multi-agent coordination
- computer-use style browser automation in controlled environments
- MCP-based generative media tools for image, video, audio, and music generation

This should complement the existing OpenAI-based realtime path in OpenCTO rather than replace it.

## Research Summary

The upstream materials point to five useful building blocks:

1. ADK bidi-streaming for production realtime agents.
2. Gemini Live / Vertex AI Live for low-latency text, audio, and video sessions.
3. MCP GenMedia servers for media generation tools exposed through MCP.
4. Gemini computer-use patterns for screenshot-plus-action control loops in sandboxed environments.
5. FastAPI + WebSocket reference apps deployed to Cloud Run.

## What OpenCTO Already Has

OpenCTO already contains the right attachment points:

- `opencto/opencto-voice-backend`: FastAPI service with run endpoints and SSE event streaming.
- `opencto/opencto-api-worker`: Cloudflare Worker that already mints realtime client tokens and brokers provider access.
- `opencto/mobile-app`: mobile surface for auth, chat, voice, and run monitoring.
- `opencto/opencto-dashboard`: dashboard surface for launchpad, auth, workflows, and monitoring.
- `opencto/cto-orchestrator`: a natural place for supervised long-running agent tasks.

This means the recommended implementation is an additive provider integration, not a platform rewrite.

## Recommended Architecture

### 1. Provider Strategy

Keep OpenCTO provider-agnostic at the API boundary:

- `opencto-api-worker` remains the control plane.
- Add a new provider family: `google_vertex`.
- Preserve OpenAI realtime support as the default existing path.
- Route Google realtime and tool-heavy sessions through a dedicated backend service instead of the Cloudflare Worker.

Reasoning:

- Cloudflare Worker is a good control plane for auth, short-lived tokens, metering, and config.
- ADK bidi-streaming and Live API session handling fit better in a long-lived Python service using WebSockets.

### 2. New Service

Add a new backend service:

- `opencto/opencto-google-live-backend`

Recommended stack:

- Python
- FastAPI
- WebSockets
- `google-adk`
- `google-genai`
- Redis for shared session state / pubsub / rate limits where needed

Responsibilities:

- terminate browser/mobile WebSocket sessions
- manage ADK `Runner`, `SessionService`, and `LiveRequestQueue`
- connect to Gemini Live API in development and Vertex AI Live in production
- execute ADK tools
- emit normalized OpenCTO run events
- optionally attach specialized agents for safety, planning, retrieval, or media generation

### 3. Control Plane Changes

Extend `opencto-api-worker` with Google session bootstrap endpoints:

- `POST /api/v1/google-live/session`
- `GET /api/v1/google-live/config`
- `POST /api/v1/google-live/tools/session`

These endpoints should:

- authenticate the user
- enforce workspace entitlements
- resolve provider selection
- return backend WebSocket URL plus ephemeral session metadata
- store trace/session ids used across Worker and backend

Do not try to proxy the full bidi stream through the Worker.

### 4. Realtime Data Path

Recommended flow:

1. Client authenticates with `opencto-api-worker`.
2. Worker creates an OpenCTO session record and returns a signed bootstrap payload.
3. Client opens WebSocket directly to `opencto-google-live-backend`.
4. Backend starts ADK `run_live()`.
5. Client sends text/audio/video frames.
6. Backend forwards tool events, audio responses, transcripts, and state updates back to client.
7. Backend mirrors summarized events into OpenCTO run storage so dashboard and mobile can observe the session.

### 5. Tooling Layers

Use three tool classes.

#### A. Native OpenCTO tools

Expose internal tools for:

- repo lookup
- run creation
- deployment inspection
- GitHub status
- billing / workspace state checks
- codebase execution approvals

#### B. MCP tools

Attach MCP servers for:

- Imagen / Gemini image generation
- Veo video generation
- Gemini TTS / Chirp
- Lyria music
- AVTool compositing

This is the cleanest path for creative-media workflows because Google already provides MCP GenMedia servers with stdio or HTTP transport.

#### C. Sandbox tools

For computer-use or web automation:

- run actions inside a locked-down browser sandbox or container
- use Playwright as the action executor
- require explicit user approvals for sensitive actions
- capture screenshots and action traces into OpenCTO artifacts

Do not run computer-use directly against arbitrary user desktops.

## Product Surfaces

### Dashboard

Add a new launchpad card and workflow:

- "Google Live Agent"
- supports voice, camera, screen, and tool session modes
- displays live transcript, tool events, and active sub-agents

Add admin settings:

- provider enablement
- project / region config
- model allowlist
- cost controls
- media tool allowlist

### Mobile App

Prioritize:

- audio-first Gemini Live sessions
- optional camera streaming
- live transcript and agent state timeline

### Voice Backend

Do not overload the current `opencto-voice-backend` with two very different providers unless we want a larger refactor.

Safer path:

- keep current voice backend for existing OpenAI path
- add `opencto-google-live-backend` alongside it
- unify event schemas at the OpenCTO API and client layer

## Multi-Agent Design

The codelabs and ADK materials make a strong case for multi-agent separation of concerns. For OpenCTO, the first useful split is:

- `DispatchAgent`: user-facing live conversation and orchestration
- `RepoAgent`: codebase and repo context
- `DeployAgent`: Cloudflare/Vercel/GitHub environment checks
- `SafetyAgent`: approval gating, policy checks, and dangerous action review
- `MediaAgent`: genmedia MCP tool orchestration

Start with a single dispatch agent plus tools, then add specialized sub-agents only where tool load or latency justifies it.

## Retrieval and Memory

The survivor-network codelab suggests a longer-term pattern that fits OpenCTO well:

- graph or hybrid retrieval for infra, repos, services, and workspace entities
- session memory for user preferences, environment defaults, and active projects

Recommended sequence:

1. Ship without Memory Bank or graph retrieval.
2. Add Redis + relational session persistence.
3. Add retrieval over OpenCTO entities.
4. Add Vertex AI Memory Bank only if personalized long-horizon memory becomes a product requirement.

## Deployment Recommendation

### Development

- run `opencto-google-live-backend` locally with FastAPI
- use Gemini Live API / AI Studio credentials for faster iteration
- use local Redis only if session fanout is needed

### Production

Deploy `opencto-google-live-backend` to Google Cloud Run.

Reasoning:

- the Google samples already assume FastAPI + WebSockets + Cloud Run as a normal path
- Cloud Run matches bursty realtime workloads better than forcing this into Workers
- Vertex AI auth is straightforward with service accounts and ADC
- MCP GenMedia servers can run as sidecars, sibling services, or dedicated internal services

Recommended production topology:

- Cloudflare Worker: auth, entitlement, bootstrap, metering, trace ids
- Cloud Run service: ADK runtime and Live API WebSocket handling
- Memorystore Redis: session fanout, transient state, rate limits
- Vertex AI: Live API, models, optional memory and retrieval services
- Cloud Storage bucket: media artifacts
- BigQuery: usage and session analytics

## Implementation Phases

### Phase 1. Foundation

- define provider-agnostic live session schema in OpenCTO
- add Google provider config to Worker and dashboard settings
- create `opencto-google-live-backend` FastAPI skeleton
- add authenticated bootstrap endpoint in Worker

### Phase 2. Single-Agent Live Sessions

- implement browser/mobile WebSocket session handling
- connect ADK runner to Gemini Live / Vertex AI Live
- support text and audio first
- normalize events into existing OpenCTO run model

### Phase 3. Video and Tools

- add camera/video frames
- add internal OpenCTO tools
- expose tool events in dashboard/mobile

### Phase 4. MCP GenMedia

- deploy selected MCP GenMedia servers
- add media tool registry and policy gating
- store generated assets as OpenCTO artifacts

### Phase 5. Computer Use

- add sandbox executor service with Playwright
- implement approval workflow for risky actions
- record screenshots, action traces, and outcomes

### Phase 6. Multi-Agent and Memory

- split dispatch into specialized agents
- add Redis-backed session coordination
- add optional retrieval / memory features

## Risks and Constraints

### 1. Two realtime stacks

OpenCTO currently has an OpenAI realtime path. Adding Google means we need a stable internal abstraction for:

- session bootstrap
- event envelopes
- transcript updates
- tool events
- usage reporting

If we skip the abstraction, the clients will fork badly.

### 2. Worker limits

Cloudflare Worker should not become the long-lived multimedia transport layer for Google sessions.

### 3. Computer-use safety

Gemini computer-use examples explicitly assume a secure execution environment plus client-side action handling. For OpenCTO that means isolated browser automation, not direct host control.

### 4. Cost control

Audio/video sessions plus generative media tools can get expensive quickly. Enforce:

- per-workspace rate limits
- model allowlists
- session duration caps
- artifact quotas

## Minimum Viable Scope

The best first release is:

- Cloudflare Worker bootstrap endpoint
- new `opencto-google-live-backend`
- single ADK dispatch agent
- text + audio live sessions
- internal OpenCTO tools only
- Cloud Run deployment

Do not start with:

- computer-use
- Memory Bank
- graph retrieval
- full genmedia suite
- multi-agent dispatch

## Concrete Next Build Steps

1. Add Google provider configuration types and secrets handling in `opencto/opencto-api-worker`.
2. Scaffold `opencto/opencto-google-live-backend` from the existing voice backend patterns.
3. Define a shared event schema used by OpenAI and Google live providers.
4. Add a dashboard launchpad flow for "Google Live Agent".
5. Deploy the backend to Cloud Run and wire the Worker bootstrap endpoint to it.
6. Add one internal tool set before any MCP or computer-use work.

## Source Links

- ADK streaming guide: https://google.github.io/adk-docs/streaming/dev-guide/part1/
- Google Cloud generative AI vision repo: https://github.com/GoogleCloudPlatform/generative-ai/tree/main/vision
- Gemini computer-use notebook: https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/computer-use
- Immersive language learning live app: https://github.com/ZackAkil/immersive-language-learning-with-live-api
- MCP GenMedia servers: https://github.com/GoogleCloudPlatform/vertex-ai-creative-studio/tree/main/experiments/mcp-genmedia
- Survivor Network codelab: https://codelabs.developers.google.com/codelabs/survivor-network/instructions#0
- Way Back Home Level 3: https://codelabs.developers.google.com/way-back-home-level-3/instructions#0
- Way Back Home Level 4: https://codelabs.developers.google.com/way-back-home-level-4/instructions#0
