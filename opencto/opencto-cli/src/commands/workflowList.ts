import type { CliConfig } from '../config'
import { resolveWorkflowRegistry } from '../workflows/registry'

export async function handleWorkflowList(config: CliConfig): Promise<void> {
  const workflows = await resolveWorkflowRegistry(config)
  for (const workflow of workflows) {
    console.log(`${workflow.id}: ${workflow.name}`)
    console.log(`  ${workflow.description}`)
  }
}
