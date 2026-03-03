import type { ParsedArgs } from '../args'
import { getFlag, getFlagList, hasFlag } from '../args'
import type { CliConfig } from '../config'
import { createClient, executeRun } from './runCore'

export async function handleRun(parsed: ParsedArgs, config: CliConfig): Promise<void> {
  const repoUrl = getFlag(parsed, 'repo-url')
  if (!repoUrl) {
    throw new Error('Missing required flag: --repo-url')
  }

  const commands = collectCommands(parsed)
  if (commands.length === 0) {
    throw new Error('Provide at least one command via --command "..."')
  }

  const client = await createClient(config)
  await executeRun(client, {
    repoUrl,
    commands,
    baseBranch: getFlag(parsed, 'base-branch'),
    targetBranch: getFlag(parsed, 'target-branch'),
    timeoutSeconds: parseNumberFlag(parsed, 'timeout-seconds'),
    waitForCompletion: hasFlag(parsed, 'wait'),
    pollMs: parseNumberFlag(parsed, 'poll-ms') ?? 2000,
  })
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
