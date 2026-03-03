import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { homedir } from 'node:os'
import type { OpenCtoTokenSet } from '../types/deviceAuth'
import type { TokenStore } from '../types/tokenStore'

type TokenStoreFile = {
  version: 1
  tokens: Record<string, OpenCtoTokenSet>
}

function defaultTokenPath(): string {
  return `${homedir()}/.opencto/tokens.json`
}

export class MemoryTokenStore implements TokenStore {
  private readonly map = new Map<string, OpenCtoTokenSet>()

  async get(key: string): Promise<OpenCtoTokenSet | null> {
    return this.map.get(key) ?? null
  }

  async set(key: string, value: OpenCtoTokenSet): Promise<void> {
    this.map.set(key, value)
  }

  async clear(key: string): Promise<void> {
    this.map.delete(key)
  }
}

export class FileTokenStore implements TokenStore {
  constructor(private readonly filePath = defaultTokenPath()) {}

  private async readStore(): Promise<TokenStoreFile> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<TokenStoreFile>
      if (parsed.version !== 1 || typeof parsed.tokens !== 'object' || parsed.tokens === null) {
        return { version: 1, tokens: {} }
      }
      return { version: 1, tokens: parsed.tokens as Record<string, OpenCtoTokenSet> }
    } catch {
      return { version: 1, tokens: {} }
    }
  }

  private async writeStore(store: TokenStoreFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(store, null, 2), { mode: 0o600 })
  }

  async get(key: string): Promise<OpenCtoTokenSet | null> {
    const store = await this.readStore()
    return store.tokens[key] ?? null
  }

  async set(key: string, value: OpenCtoTokenSet): Promise<void> {
    const store = await this.readStore()
    store.tokens[key] = value
    await this.writeStore(store)
  }

  async clear(key: string): Promise<void> {
    const store = await this.readStore()
    delete store.tokens[key]
    if (Object.keys(store.tokens).length === 0) {
      await rm(this.filePath, { force: true })
      return
    }
    await this.writeStore(store)
  }
}

export function createTokenGetter(store: TokenStore, key: string): () => Promise<string | null> {
  return async () => {
    const token = await store.get(key)
    return token?.accessToken ?? null
  }
}
