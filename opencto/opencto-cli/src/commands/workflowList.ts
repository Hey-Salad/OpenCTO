import { listWorkflows } from '../workflows/catalog'

export async function handleWorkflowList(): Promise<void> {
  const workflows = listWorkflows()
  for (const workflow of workflows) {
    console.log(`${workflow.id}: ${workflow.name}`)
    console.log(`  ${workflow.description}`)
  }
}
