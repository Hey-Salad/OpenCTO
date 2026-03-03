import { createMqttAgentTransport } from '@heysalad/opencto'
import type { ParsedArgs } from '../args.js'
import { getFlag, hasFlag } from '../args.js'
import type { CliConfig } from '../config.js'

export async function handleAgentStart(parsed: ParsedArgs, config: CliConfig): Promise<void> {
  const brokerUrl = getFlag(parsed, 'broker-url')
  const agentId = getFlag(parsed, 'agent-id')
  if (!brokerUrl) throw new Error('Missing required flag: --broker-url')
  if (!agentId) throw new Error('Missing required flag: --agent-id')

  const autoComplete = !hasFlag(parsed, 'no-auto-complete')
  const role = getFlag(parsed, 'role') ?? 'worker'

  const transport = createMqttAgentTransport({
    brokerUrl,
    workspaceId: config.workspaceKey,
    agentId,
    role,
  })

  transport.onTask(async (envelope) => {
    console.log(`Task received: ${envelope.payload.taskId} (${envelope.payload.taskType})`)
    await transport.publishTaskAssigned({ taskId: envelope.payload.taskId })

    if (autoComplete) {
      await transport.publishTaskComplete({
        taskId: envelope.payload.taskId,
        output: {
          acceptedAt: new Date().toISOString(),
          input: envelope.payload.input,
          handledBy: role,
        },
      })
      console.log(`Task completed: ${envelope.payload.taskId}`)
    }
  })

  await transport.start()
  console.log(`Agent started: ${agentId} on ${brokerUrl} (workspace=${config.workspaceKey})`)

  await new Promise<void>((resolve) => {
    process.on('SIGINT', async () => {
      await transport.stop()
      resolve()
    })
  })
}
