import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ParsedArgs } from './args'
import { getFlag } from './args'

export interface CliConfig {
  apiBaseUrl: string
  authBaseUrl: string
  workspaceKey: string
  tokenPath: string
  tokenOverride?: string
}

export function resolveConfig(parsed: ParsedArgs, env: NodeJS.ProcessEnv = process.env): CliConfig {
  const apiBaseUrl = getFlag(parsed, 'api-base-url') ?? env.OPENCTO_API_BASE_URL ?? 'https://api.opencto.works'
  const authBaseUrl = getFlag(parsed, 'auth-base-url') ?? env.OPENCTO_AUTH_BASE_URL ?? apiBaseUrl
  const workspaceKey = getFlag(parsed, 'workspace') ?? env.OPENCTO_WORKSPACE ?? 'default'
  const tokenPathRaw = getFlag(parsed, 'token-path') ?? env.OPENCTO_TOKEN_PATH ?? '~/.opencto/tokens.json'
  const tokenOverride = getFlag(parsed, 'token') ?? env.OPENCTO_TOKEN

  return {
    apiBaseUrl: stripSlash(apiBaseUrl),
    authBaseUrl: stripSlash(authBaseUrl),
    workspaceKey,
    tokenPath: expandHome(tokenPathRaw),
    tokenOverride,
  }
}

function stripSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function expandHome(value: string): string {
  if (value === '~') return homedir()
  if (value.startsWith('~/')) return join(homedir(), value.slice(2))
  return value
}
