import { describe, expect, it } from 'vitest'
import { parseArgs } from '../src/args'
import { resolveConfig } from '../src/config'

describe('config', () => {
  it('resolves from flags with env fallback', () => {
    const parsed = parseArgs([
      'run',
      '--workspace', 'ws_cli',
      '--api-base-url', 'https://api.example.com/',
      '--workflows-file', '~/opencto.workflows.yaml',
    ])

    const config = resolveConfig(parsed, {
      OPENCTO_AUTH_BASE_URL: 'https://auth.example.com/',
      OPENCTO_TOKEN_PATH: '/tmp/tokens.json',
    })

    expect(config.workspaceKey).toBe('ws_cli')
    expect(config.apiBaseUrl).toBe('https://api.example.com')
    expect(config.authBaseUrl).toBe('https://auth.example.com')
    expect(config.tokenPath).toBe('/tmp/tokens.json')
    expect(config.workflowsFile).toContain('opencto.workflows.yaml')
  })
})
