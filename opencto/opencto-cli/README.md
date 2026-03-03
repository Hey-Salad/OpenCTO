# @heysalad/opencto-cli

CLI wrapper around `@heysalad/opencto` for fast operational workflows.

## Install

```bash
npm install -g @heysalad/opencto-cli
```

## Commands

```bash
opencto login --workspace ws_demo
opencto run --workspace ws_demo --repo-url https://github.com/org/repo --command "npm test" --wait
opencto agent start --workspace ws_demo --agent-id agent_01 --broker-url mqtt://localhost:1883
opencto workflow list
opencto workflow run engineering-ci --workspace ws_demo --repo-url https://github.com/org/repo --wait
```

## Environment

- `OPENCTO_API_BASE_URL` (default: `https://api.opencto.works`)
- `OPENCTO_AUTH_BASE_URL` (default: same as API base)
- `OPENCTO_WORKSPACE` (default: `default`)
- `OPENCTO_TOKEN_PATH` (default: `~/.opencto/tokens.json`)
- `OPENCTO_WORKFLOWS_FILE` (optional path to JSON/YAML workflow directory file)
- `OPENCTO_TOKEN` (optional override for run commands)

Release runbook: [`../OPENCTO_PACKAGES_RELEASE.md`](../OPENCTO_PACKAGES_RELEASE.md)
