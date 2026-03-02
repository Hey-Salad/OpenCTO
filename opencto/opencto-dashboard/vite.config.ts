import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http' // IncomingMessage used in middleware callback

// Helper: mint an OpenAI ephemeral key server-side and return { clientSecret, expiresAt }
async function handleRealtimeToken(res: ServerResponse, apiKey: string): Promise<void> {
  const oaRes = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: '{}',
  })

  const data = await oaRes.json() as Record<string, unknown>

  if (!oaRes.ok) {
    res.writeHead(oaRes.status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'OpenAI error', details: data }))
    return
  }

  const { value, expires_at } = data as { value?: string; expires_at?: number }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ clientSecret: value, expiresAt: expires_at }))
}

export default defineConfig(({ mode }) => {
  // Load all .env/.env.local vars — including non-VITE_ ones for server-side use only.
  // OPENAI_API_KEY is never bundled into the client.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // Ensure pretty routes work locally (Vite dev/preview) like production redirects.
    plugins: [
      react(),
      {
        name: 'opencto-static-route-rewrites',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (!req.url) return next()
            const rewrites: Record<string, string> = {
              '/app': '/index.html',
              '/app/': '/index.html',
              '/landing': '/index.html',
              '/landing/': '/index.html',
              '/playground': '/index.html',
              '/playground/': '/index.html',
            }
            if (rewrites[req.url]) req.url = rewrites[req.url]
            next()
          })

          // Local dev: mint ephemeral OpenAI keys without needing `wrangler dev`.
          // Set OPENAI_API_KEY in .env.local — it stays server-side and is never bundled.
          server.middlewares.use(
            '/api/v1/realtime/token',
            (req: IncomingMessage, res: ServerResponse, next: () => void) => {
              if (req.method !== 'POST') return next()
              const apiKey = env.OPENAI_API_KEY
              if (!apiKey) {
                res.writeHead(503, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'OPENAI_API_KEY not set in .env.local' }))
                return
              }
              handleRealtimeToken(res, apiKey).catch((err: unknown) => {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: String(err) }))
              })
            },
          )
        },
        configurePreviewServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (!req.url) return next()
            const rewrites: Record<string, string> = {
              '/app': '/index.html',
              '/app/': '/index.html',
              '/landing': '/index.html',
              '/landing/': '/index.html',
              '/playground': '/index.html',
              '/playground/': '/index.html',
            }
            if (rewrites[req.url]) req.url = rewrites[req.url]
            next()
          })
        },
      },
    ],
    server: {
      proxy: {
        // Fallback: proxy remaining /api/* to wrangler dev on port 8787.
        // The /api/v1/realtime/token route above intercepts first when wrangler isn't running.
        '/api': 'http://localhost:8787',
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  }
})
