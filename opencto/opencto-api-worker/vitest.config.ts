import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const containersMockPath = fileURLToPath(new URL('./src/test/cloudflareContainersMock.ts', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@cloudflare/containers': containersMockPath,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
