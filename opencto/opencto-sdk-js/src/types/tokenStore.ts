import type { OpenCtoTokenSet } from './deviceAuth.js'

export interface TokenStore {
  get(key: string): Promise<OpenCtoTokenSet | null>
  set(key: string, value: OpenCtoTokenSet): Promise<void>
  clear(key: string): Promise<void>
}
