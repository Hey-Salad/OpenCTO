import type { ParsedArgs } from '../args'
import { getFlag, getFlagList, hasFlag } from '../args'
import type { CliConfig } from '../config'
import { getWorkflow, renderCommandTemplates } from '../workflows/catalog'
import { createClient, executeRun } from './runCore'

export async function handleWorkflowRun(parsed: ParsedArgs, config: CliConfig): Promise<void> {
  const workflowId = parsed.command[2]
  if (!workflowId) throw new Error('Missing workflow id. Usage: opencto workflow run <workflow-id>')

  const workflow = getWorkflow(workflowId)
  if (!workflow) {
    throw new Error(`Unknown workflow id: ${workflowId}. Use 'opencto workflow list' to view available workflows.`)
  }

  const repoUrl = getFlag(parsed, 'repo-url')
  if (!repoUrl) throw new Error('Missing required flag: --repo-url')

  const templates = workflow.id === 'custom' ? getFlagList(parsed, 'template') : workflow.commandTemplates
  if (templates.length === 0) {
    throw new Error('No templates found. Use --template \"<command>\" for custom workflow.')
  }

  const variables = parseVariables(getFlagList(parsed, 'var'))
  const commands = renderCommandTemplates(templates, variables)

  console.log(`Workflow: ${workflow.id} (${workflow.name})`)
  for (const command of commands) {
    console.log(`- ${command}`)
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

function parseVariables(items: string[]): Record<string, string> {
  const variables: Record<string, string> = {}
  for (const item of items) {
    const idx = item.indexOf('=')
    if (idx <= 0 || idx === item.length - 1) {
      throw new Error(`Invalid --var entry '${item}'. Use key=value format.`)
    }
    const key = item.slice(0, idx).trim()
    const value = item.slice(idx + 1).trim()
    if (!key || !value) {
      throw new Error(`Invalid --var entry '${item}'. Use key=value format.`)
    }
    variables[key] = value
  }
  return variables
}

function parseNumberFlag(parsed: ParsedArgs, key: string): number | undefined {
  const raw = getFlag(parsed, key)
  if (!raw) return undefined
  const num = Number(raw)
  if (!Number.isFinite(num)) throw new Error(`Invalid number for --${key}: ${raw}`)
  return num
}
