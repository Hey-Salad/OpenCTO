import type { OpenCtoTokenSet } from './deviceAuth'

export interface TokenStore {
  get(key: string): Promise<OpenCtoTokenSet | null>
  set(key: string, value: OpenCtoTokenSet): Promise<void>
  clear(key: string): Promise<void>
}
