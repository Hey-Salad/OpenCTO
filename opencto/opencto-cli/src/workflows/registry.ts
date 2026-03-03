import { access, readFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import type { CliConfig } from '../config.js'
import { type WorkflowDefinition, listBuiltinWorkflows } from './catalog.js'

interface WorkflowRegistryFile {
  workflows: WorkflowDefinition[]
}

const DEFAULT_WORKFLOW_FILES = [
  'opencto.workflows.json',
  'opencto.workflows.yaml',
  'opencto.workflows.yml',
]

export async function resolveWorkflowRegistry(
  config: CliConfig,
  cwd: string = process.cwd(),
): Promise<WorkflowDefinition[]> {
  const filePath = config.workflowsFile ?? await discoverWorkflowFile(cwd)
  if (!filePath) {
    return listBuiltinWorkflows()
  }

  const loaded = await loadWorkflowFile(filePath)
  return mergeWorkflows(listBuiltinWorkflows(), loaded.workflows)
}

async function discoverWorkflowFile(cwd: string): Promise<string | null> {
  for (const file of DEFAULT_WORKFLOW_FILES) {
    const fullPath = join(cwd, file)
    if (await fileExists(fullPath)) return fullPath
  }
  return null
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.R_OK)
    return true
  } catch {
    return false
  }
}

async function loadWorkflowFile(path: string): Promise<WorkflowRegistryFile> {
  const raw = await readFile(path, 'utf8')
  const parsed = parseWorkflowFile(path, raw)
  return validateRegistry(parsed, path)
}

function parseWorkflowFile(path: string, raw: string): unknown {
  if (path.endsWith('.json')) {
    return JSON.parse(raw)
  }
  if (path.endsWith('.yaml') || path.endsWith('.yml')) {
    return parseYaml(raw)
  }
  throw new Error(`Unsupported workflow file type: ${path}`)
}

function validateRegistry(input: unknown, source: string): WorkflowRegistryFile {
  if (!input || typeof input !== 'object') {
    throw new Error(`Invalid workflows file format in ${source}`)
  }
  const candidate = input as { workflows?: unknown }
  if (!Array.isArray(candidate.workflows)) {
    throw new Error(`Missing 'workflows' array in ${source}`)
  }

  const workflows: WorkflowDefinition[] = candidate.workflows.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid workflow at index ${index} in ${source}`)
    }
    const workflow = item as Partial<WorkflowDefinition>
    if (!workflow.id || !workflow.name || !workflow.description || !Array.isArray(workflow.commandTemplates)) {
      throw new Error(`Workflow at index ${index} in ${source} is missing required fields`)
    }
    if (workflow.commandTemplates.some((command) => typeof command !== 'string' || !command.trim())) {
      throw new Error(`Workflow '${workflow.id}' in ${source} has invalid command templates`)
    }
    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      commandTemplates: workflow.commandTemplates,
    }
  })

  return { workflows }
}

function mergeWorkflows(
  builtin: WorkflowDefinition[],
  external: WorkflowDefinition[],
): WorkflowDefinition[] {
  const map = new Map<string, WorkflowDefinition>()
  for (const workflow of builtin) map.set(workflow.id, workflow)
  for (const workflow of external) map.set(workflow.id, workflow)
  return [...map.values()]
}
