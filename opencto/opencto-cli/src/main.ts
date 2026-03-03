import { parseArgs, hasFlag } from './args'
import { resolveConfig } from './config'
import { handleAgentStart } from './commands/agentStart'
import { handleLogin } from './commands/login'
import { handleRun } from './commands/run'
import { USAGE } from './usage'

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

  throw new Error(`Unknown command: ${parsed.command.join(' ')}`)
}
