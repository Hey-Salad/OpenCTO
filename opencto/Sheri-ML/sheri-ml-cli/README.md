# @heysalad/sheri-ml-cli

Sheri ML CLI is a coding assistant runtime used in OpenCTO for interactive coding, MCP tool access, and OpenClaw swarm workers.

## What This CLI Supports

- Interactive coding chat (`sheri`)
- Direct prompt execution (`sheri "<prompt>"`)
- MCP-domain tool usage
- OpenClaw worker roles (`planner`, `coder`, `reviewer`, `qa`)

## Prerequisites

- Node.js `>= 18`
- npm
- At least one model credential:
  - `GOOGLE_AI_STUDIO_KEY` (recommended)
  - `ANTHROPIC_API_KEY`

## Install

Global install:

```bash
npm install -g @heysalad/sheri-ml-cli
```

Local repo install:

```bash
cd opencto/Sheri-ML/sheri-ml-cli
npm install
npm run build
```

## Quick Start

### 1) Configure credentials

```bash
sheri config
```

Configuration is stored in `~/.sheri-ml/.env` with restricted file permissions.

### 2) Start chat mode

```bash
sheri
```

### 3) Run a single prompt

```bash
sheri "create a REST API with Express and TypeScript"
```

## Environment Variables

```bash
GOOGLE_AI_STUDIO_KEY=...
ANTHROPIC_API_KEY=...
```

If both are present, provider selection is controlled by CLI/model settings.

## Chat Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/models` | List models |
| `/model` | Open model picker |
| `/model <id>` | Switch model directly |
| `/mcp <query>` | Query MCP knowledge/tools |
| `/tool <domain> <tool> ...` | Run a direct tool call |
| `/router` | Toggle SmartRouter mode |
| `/stats` | Show session usage stats |
| `/clear` | Clear terminal output |
| `/exit` | Exit session |

## MCP Domains

Sheri supports the following domain families:

- `engineering`
- `sales`
- `customer-success`
- `marketing`
- `people`
- `finance`
- `data`
- `executive`

Direct call example:

```bash
sheri --chat
# then:
/tool sales draft_outbound_email company="Acme" pain_point="slow deploys"
```

## OpenClaw Swarm Mode

Sheri can run as a long-lived OpenClaw worker and claim assignments from `opencto-api-worker`.

### Required environment

```bash
export OPENCTO_INTERNAL_API_TOKEN=...
export OPENCLAW_API_BASE_URL=https://opencto-api-worker.heysalad-o.workers.dev
export OPENCLAW_SWARM=openclaw-dev
```

### Run one worker manually

```bash
npx tsx src/cli-v2.ts openclaw-worker --role coder --agent-id openclaw-coder-01
```

### Launch local multi-role swarm with tmux

```bash
./start-openclaw-swarm.sh
tmux attach -t openclaw-swarm
```

Roles launched by the helper:

- `planner`
- `coder`
- `reviewer`
- `qa`

Behavior notes:

- `coder` dispatches into internal `codebase/runs` execution APIs.
- Other roles submit structured handoff and completion payloads for orchestration tracking.

## Raspberry Pi Notes

Install and run using the same Node/npm steps. No local GPU is required for cloud-backed models.

## Troubleshooting

- If `sheri` fails at startup, verify `node -v` is `>= 18`.
- If tool calls fail, confirm your MCP/API credentials are configured.
- If OpenClaw workers do not claim work, confirm:
  - `OPENCTO_INTERNAL_API_TOKEN` matches the API worker secret
  - `OPENCLAW_API_BASE_URL` is reachable
  - assignment queue has ready tasks for the role/swarm

## How-To Guides

### How to run a first interactive coding session

1. Install CLI (`npm install -g @heysalad/sheri-ml-cli` or local build).
2. Run `sheri config` and set at least one provider key.
3. Run `sheri`.
4. Execute one prompt and confirm output/files are generated as expected.

### How to run one OpenClaw worker

1. Export `OPENCTO_INTERNAL_API_TOKEN`, `OPENCLAW_API_BASE_URL`, and `OPENCLAW_SWARM`.
2. Start a worker:
   `npx tsx src/cli-v2.ts openclaw-worker --role coder --agent-id openclaw-coder-01`
3. Verify the worker claims assignments and heartbeats successfully.

### How to run a full local swarm

1. Ensure `tmux` is installed.
2. Run `./start-openclaw-swarm.sh`.
3. Attach with `tmux attach -t openclaw-swarm`.
4. Confirm all four roles are running and processing handoffs.

## References (Chicago 17th, Bibliography)

Node.js. n.d. "Node.js Documentation." Accessed March 6, 2026. https://nodejs.org/docs/latest/api/.

npm, Inc. n.d. "npm CLI Docs." Accessed March 6, 2026. https://docs.npmjs.com/cli/v10/commands.

tmux Project. n.d. "tmux GitHub Repository and Documentation." Accessed March 6, 2026. https://github.com/tmux/tmux.
