# OpenCTO SDK + CLI Quickstart

## Install

SDK:

```bash
npm install @heysalad/opencto@0.1.1
```

CLI:

```bash
npm install -g @heysalad/opencto-cli@0.1.1
```

## SDK Quickstart

```ts
import { createOpenCtoClient } from '@heysalad/opencto'

const client = createOpenCtoClient({
  baseUrl: process.env.OPENCTO_API_BASE_URL ?? 'https://api.opencto.works',
  getToken: () => process.env.OPENCTO_TOKEN ?? null,
})

const session = await client.auth.getSession()
console.log(session.user?.email)
```

## CLI Quickstart

Set baseline environment:

```bash
export OPENCTO_API_BASE_URL="https://api.opencto.works"
export OPENCTO_WORKSPACE="ws_demo"
```

Authenticate:

```bash
opencto login --workspace "$OPENCTO_WORKSPACE"
```

List workflow directory:

```bash
opencto workflow list --workspace "$OPENCTO_WORKSPACE"
```

Run a workflow:

```bash
opencto workflow run engineering-ci \
  --workspace "$OPENCTO_WORKSPACE" \
  --repo-url https://github.com/org/repo \
  --wait
```

## Scripted Demo

Use:

```bash
./opencto/scripts/demo-opencto-e2e.sh --repo-url https://github.com/org/repo
```

The script runs:

1. optional `opencto login`
2. `opencto workflow list`
3. `opencto workflow run custom ... --wait`

## Package Links

- npm SDK: https://www.npmjs.com/package/@heysalad/opencto
- npm CLI: https://www.npmjs.com/package/@heysalad/opencto-cli
- GitHub release: https://github.com/Hey-Salad/CTO-AI/releases/tag/v0.1.1
