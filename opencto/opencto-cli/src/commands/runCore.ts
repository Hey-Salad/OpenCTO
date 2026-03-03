import { setTimeout as sleep } from 'node:timers/promises'
import {
  FileTokenStore,
  createOpenCtoClient,
  createTokenGetter,
  type CodebaseRunStatus,
  type OpenCtoClient,
} from '@heysalad/opencto'
import type { CliConfig } from '../config'

const TERMINAL_STATUSES: CodebaseRunStatus[] = ['succeeded', 'failed', 'canceled', 'timed_out']

export interface StartRunInput {
  repoUrl: string
  commands: string[]
  baseBranch?: string
  targetBranch?: string
  timeoutSeconds?: number
  waitForCompletion?: boolean
  pollMs?: number
}

export async function createClient(config: CliConfig): Promise<OpenCtoClient> {
  return createOpenCtoClient({
    baseUrl: config.apiBaseUrl,
    getToken: await resolveTokenGetter(config),
  })
}

export async function executeRun(
  client: OpenCtoClient,
  input: StartRunInput,
): Promise<void> {
  const created = await client.runs.create({
    repoUrl: input.repoUrl,
    commands: input.commands,
    baseBranch: input.baseBranch,
    targetBranch: input.targetBranch,
    timeoutSeconds: input.timeoutSeconds,
  })

  console.log(`Run created: ${created.run.id}`)
  console.log(`Status: ${created.run.status}`)

  if (!input.waitForCompletion) return

  let lastSeq = 0
  const pollMs = input.pollMs ?? 2000
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
