# @heysalad/opencto

TypeScript SDK for OpenCTO APIs.

## Install

```bash
npm install @heysalad/opencto
```

## Quick Start

```ts
import { createOpenCtoClient } from '@heysalad/opencto'

const client = createOpenCtoClient({
  baseUrl: 'https://api.opencto.works',
  getToken: () => process.env.OPENCTO_TOKEN ?? null,
})

const session = await client.auth.getSession()
console.log(session.user?.email)
```

## API Surface

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
npm ci
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
