import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import type { CliConfig } from '../src/config'
import { resolveWorkflowRegistry } from '../src/workflows/registry'

function baseConfig(overrides: Partial<CliConfig> = {}): CliConfig {
  return {
    apiBaseUrl: 'https://api.opencto.works',
    authBaseUrl: 'https://api.opencto.works',
    workspaceKey: 'default',
    tokenPath: '/tmp/tokens.json',
    ...overrides,
  }
}

describe('workflow registry', () => {
  it('loads and merges from json file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opencto-cli-registry-'))
    try {
      const file = join(dir, 'opencto.workflows.json')
      await writeFile(file, JSON.stringify({
        workflows: [
          {
            id: 'engineering-ci',
            name: 'Engineering CI (Custom)',
            description: 'Override.',
            commandTemplates: ['pnpm install', 'pnpm test'],
          },
          {
            id: 'founder-demo',
            name: 'Founder Demo',
            description: 'Generate demo artifacts.',
            commandTemplates: ['npm run demo:build'],
          },
        ],
      }, null, 2))

      const workflows = await resolveWorkflowRegistry(baseConfig({ workflowsFile: file }), dir)
      const override = workflows.find((item) => item.id === 'engineering-ci')
      const custom = workflows.find((item) => item.id === 'founder-demo')
      expect(override?.name).toBe('Engineering CI (Custom)')
      expect(custom?.commandTemplates).toEqual(['npm run demo:build'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('auto-discovers yaml file in cwd', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opencto-cli-registry-'))
    try {
      const file = join(dir, 'opencto.workflows.yaml')
      await writeFile(file, [
        'workflows:',
        '  - id: "content-seo"',
        '    name: "Content SEO"',
        '    description: "Generate and validate content."',
        '    commandTemplates:',
        '      - "npm run content:plan"',
      ].join('\n'))

      const workflows = await resolveWorkflowRegistry(baseConfig(), dir)
      expect(workflows.some((item) => item.id === 'content-seo')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
