import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FileTokenStore, MemoryTokenStore, createTokenGetter } from '../src/auth/tokenStore'

describe('token stores', () => {
  it('stores in memory', async () => {
    const store = new MemoryTokenStore()
    await store.set('w1', {
      accessToken: 'abc',
      issuedAt: new Date().toISOString(),
    })

    const token = await store.get('w1')
    expect(token?.accessToken).toBe('abc')

    await store.clear('w1')
    expect(await store.get('w1')).toBeNull()
  })

  it('stores in file', async () => {
    const dir = await mkdtemp(join(tmpdir(), `opencto-sdk-${randomUUID()}`))
    const filePath = join(dir, 'tokens.json')
    const store = new FileTokenStore(filePath)

    await store.set('workspace_a', {
      accessToken: 'tok-file',
      refreshToken: 'ref-file',
      issuedAt: new Date().toISOString(),
    })

    const raw = await readFile(filePath, 'utf8')
    expect(raw).toContain('workspace_a')

    const token = await store.get('workspace_a')
    expect(token?.refreshToken).toBe('ref-file')

    const getter = createTokenGetter(store, 'workspace_a')
    expect(await getter()).toBe('tok-file')

    await store.clear('workspace_a')
    expect(await store.get('workspace_a')).toBeNull()
  })
})
