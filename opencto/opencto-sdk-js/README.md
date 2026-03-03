# @heysalad/opencto

TypeScript SDK for OpenCTO APIs and MQTT transport.

## Install

```bash
npm install @heysalad/opencto
```

## Quick Start (HTTP API)

```ts
import { createOpenCtoClient } from '@heysalad/opencto'

const client = createOpenCtoClient({
  baseUrl: 'https://api.opencto.works',
  getToken: () => process.env.OPENCTO_TOKEN ?? null,
})

const session = await client.auth.getSession()
console.log(session.user?.email)
```

## Quick Start (MQTT agent transport)

```ts
import { createMqttAgentTransport } from '@heysalad/opencto'

const transport = createMqttAgentTransport({
  brokerUrl: 'mqtt://localhost:1883',
  workspaceId: 'ws_dev',
  agentId: 'agent_content_01',
  role: 'content',
})

transport.onTask(async ({ payload }) => {
  await transport.publishTaskAssigned({ taskId: payload.taskId })
  await transport.publishTaskComplete({
    taskId: payload.taskId,
    output: { ok: true },
  })
})

await transport.start()
```

## API Surface

- `createOpenCtoClient(options)`
- `createMqttAgentTransport(options)`
- `createMqttOrchestratorTransport(options)`

HTTP clients:
- `client.auth.getSession()`
- `client.auth.deleteAccount()`
- `client.chats.list()`
- `client.chats.get(chatId)`
- `client.chats.save(payload)`
- `client.runs.create(payload)`
- `client.runs.get(runId)`
- `client.runs.events(runId, options?)`
- `client.runs.cancel(runId)`
- `client.runs.artifacts(runId)`
- `client.runs.artifactUrl(runId, artifactId)`
- `client.realtime.createToken(model?)`

## Protocol Docs

- MQTT contract: [docs/mqtt-protocol-v1.md](./docs/mqtt-protocol-v1.md)

## React Native Example

```ts
import * as SecureStore from 'expo-secure-store'
import { createOpenCtoClient } from '@heysalad/opencto'

const client = createOpenCtoClient({
  baseUrl: 'https://api.opencto.works',
  getToken: () => SecureStore.getItemAsync('opencto_token'),
})
```

## Node / OpenClaw Example

```ts
import { createOpenCtoClient } from '@heysalad/opencto'

const client = createOpenCtoClient({
  baseUrl: process.env.OPENCTO_API_BASE_URL ?? 'https://api.opencto.works',
  getToken: () => process.env.OPENCTO_TOKEN ?? null,
})

const run = await client.runs.create({
  repoUrl: 'https://github.com/org/repo',
  commands: ['npm install', 'npm test'],
})

console.log(run.run.id)
```

## Development

```bash
npm install
npm run lint
npm run test
npm run build
npm pack
```

## Publishing

Package is configured as scoped public package:

- `name: @heysalad/opencto`
- `publishConfig.access: public`

Publish when ready:

```bash
npm login
npm publish
```
