import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Ensure pretty routes work locally (Vite dev/preview) like production redirects.
  // This prevents fallback to stale index content on /press, /blog, /app, /playground.
  plugins: [
    react(),
    {
      name: 'opencto-static-route-rewrites',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (!req.url) return next()
          const rewrites: Record<string, string> = {
            '/press': '/press.html',
            '/press/': '/press.html',
            '/blog': '/blog.html',
            '/blog/': '/blog.html',
            '/app': '/app.html',
            '/app/': '/app.html',
            '/landing': '/landing.html',
            '/landing/': '/landing.html',
            '/playground': '/app.html',
            '/playground/': '/app.html',
          }
          if (rewrites[req.url]) req.url = rewrites[req.url]
          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (!req.url) return next()
          const rewrites: Record<string, string> = {
            '/press': '/press.html',
            '/press/': '/press.html',
            '/blog': '/blog.html',
            '/blog/': '/blog.html',
            '/app': '/app.html',
            '/app/': '/app.html',
            '/landing': '/landing.html',
            '/landing/': '/landing.html',
            '/playground': '/app.html',
            '/playground/': '/app.html',
          }
          if (rewrites[req.url]) req.url = rewrites[req.url]
          next()
        })
      },
    },
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
