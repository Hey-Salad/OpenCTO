import { setTimeout as sleep } from 'node:timers/promises'
import {
  FileTokenStore,
  createOpenCtoClient,
  createTokenGetter,
  type CodebaseRunStatus,
} from '@heysalad/opencto'
import type { ParsedArgs } from '../args'
import { getFlag, getFlagList, hasFlag } from '../args'
import type { CliConfig } from '../config'

const TERMINAL_STATUSES: CodebaseRunStatus[] = ['succeeded', 'failed', 'canceled', 'timed_out']

export async function handleRun(parsed: ParsedArgs, config: CliConfig): Promise<void> {
  const repoUrl = getFlag(parsed, 'repo-url')
  if (!repoUrl) {
    throw new Error('Missing required flag: --repo-url')
  }

  const commands = collectCommands(parsed)
  if (commands.length === 0) {
    throw new Error('Provide at least one command via --command "..."')
  }

  const client = createOpenCtoClient({
    baseUrl: config.apiBaseUrl,
    getToken: await resolveTokenGetter(config),
  })

  const created = await client.runs.create({
    repoUrl,
    commands,
    baseBranch: getFlag(parsed, 'base-branch'),
    targetBranch: getFlag(parsed, 'target-branch'),
    timeoutSeconds: parseNumberFlag(parsed, 'timeout-seconds'),
  })

  console.log(`Run created: ${created.run.id}`)
  console.log(`Status: ${created.run.status}`)

  if (!hasFlag(parsed, 'wait')) return

  let lastSeq = 0
  const pollMs = parseNumberFlag(parsed, 'poll-ms') ?? 2000
  while (true) {
    const run = await client.runs.get(created.run.id)
    const events = await client.runs.events(created.run.id, { afterSeq: lastSeq, limit: 100 })

    for (const event of events.events) {
      console.log(`[${event.level}] ${event.eventType}: ${event.message}`)
      lastSeq = Math.max(lastSeq, event.seq)
    }

    if (TERMINAL_STATUSES.includes(run.run.status)) {
      console.log(`Run finished: ${run.run.status}`)
      return
    }

    await sleep(pollMs)
  }
}

async function resolveTokenGetter(config: CliConfig): Promise<() => Promise<string | null>> {
  if (config.tokenOverride) {
    return async () => config.tokenOverride ?? null
  }
  const store = new FileTokenStore(config.tokenPath)
  return createTokenGetter(store, config.workspaceKey)
}

function collectCommands(parsed: ParsedArgs): string[] {
  const repeated = getFlagList(parsed, 'command')
  const csv = getFlag(parsed, 'commands')
  if (!csv) return repeated
  return [...repeated, ...csv.split(',').map((item) => item.trim()).filter(Boolean)]
}

function parseNumberFlag(parsed: ParsedArgs, key: string): number | undefined {
  const raw = getFlag(parsed, key)
  if (!raw) return undefined
  const num = Number(raw)
  if (!Number.isFinite(num)) throw new Error(`Invalid number for --${key}: ${raw}`)
  return num
}
