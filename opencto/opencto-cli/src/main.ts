import { parseArgs, hasFlag } from './args.js'
import { resolveConfig } from './config.js'
import { handleAgentStart } from './commands/agentStart.js'
import { handleLogin } from './commands/login.js'
import { handleRun } from './commands/run.js'
import { handleWorkflowList } from './commands/workflowList.js'
import { handleWorkflowRun } from './commands/workflowRun.js'
import { USAGE } from './usage.js'

export async function runCli(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv)

  if (hasFlag(parsed, 'help') || parsed.command.length === 0) {
    console.log(USAGE)
    return
  }

  const config = resolveConfig(parsed)

  if (parsed.command[0] === 'login') {
    await handleLogin(parsed, config)
    return
  }

  if (parsed.command[0] === 'run') {
    await handleRun(parsed, config)
    return
  }

  if (parsed.command[0] === 'agent' && parsed.command[1] === 'start') {
    await handleAgentStart(parsed, config)
    return
  }

  if (parsed.command[0] === 'workflow' && parsed.command[1] === 'list') {
    await handleWorkflowList(config)
    return
  }

  if (parsed.command[0] === 'workflow' && parsed.command[1] === 'run') {
    await handleWorkflowRun(parsed, config)
    return
  }

  throw new Error(`Unknown command: ${parsed.command.join(' ')}`)
}
