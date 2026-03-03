export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  commandTemplates: string[]
}

const WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'engineering-ci',
    name: 'Engineering CI',
    description: 'Install, lint, test, and build the repository.',
    commandTemplates: ['npm ci', 'npm run lint', 'npm test', 'npm run build'],
  },
  {
    id: 'landing-page-refresh',
    name: 'Landing Page Refresh',
    description: 'Validate and build marketing surface before deployment.',
    commandTemplates: ['npm ci', 'npm run lint', 'npm run build'],
  },
  {
    id: 'sdk-release-check',
    name: 'SDK Release Check',
    description: 'Run strict package quality checks before npm publish.',
    commandTemplates: ['npm ci', 'npm run lint', 'npm run test', 'npm pack'],
  },
  {
    id: 'app-store-preflight',
    name: 'App Store Preflight',
    description: 'Validate Expo app quality gates for release candidate.',
    commandTemplates: ['npm ci', 'npm run lint', 'npm run test', 'npm run build'],
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Execute custom command templates provided via --template.',
    commandTemplates: [],
  },
]

export function listBuiltinWorkflows(): WorkflowDefinition[] {
  return [...WORKFLOWS]
}

export function listWorkflows(): WorkflowDefinition[] {
  return listBuiltinWorkflows()
}

export function getWorkflow(id: string): WorkflowDefinition | null {
  return WORKFLOWS.find((workflow) => workflow.id === id) ?? null
}

export function renderCommandTemplates(
  templates: string[],
  variables: Record<string, string>,
): string[] {
  return templates.map((template) => template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key]
    if (!value) {
      throw new Error(`Missing workflow variable: ${key}`)
    }
    return value
  }))
}
