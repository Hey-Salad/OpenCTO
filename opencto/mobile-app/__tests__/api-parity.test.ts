import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGitHubOAuthStartUrl } from '@/auth/oauth';
import { getRunEventsStreamUrl } from '@/api/runs';

const workerRouterSource = readFileSync(
  resolve(__dirname, '../../opencto-api-worker/src/index.ts'),
  'utf8'
);

describe('mobile api parity', () => {
  it('keeps the worker router aligned with mobile-used endpoints', () => {
    const oauthStartUrl = new URL(buildGitHubOAuthStartUrl('https://api.opencto.works'));

    expect(oauthStartUrl.pathname).toBe('/api/v1/auth/oauth/github/start');

    const requiredRouteSnippets = [
      "if (path === '/api/v1/auth/oauth/github/start' && request.method === 'GET')",
      "if (path === '/api/v1/auth/session' && method === 'GET')",
      "if (path === '/api/v1/auth/account' && method === 'DELETE')",
      "if (path === '/api/v1/chats' && method === 'GET')",
      "if (path.match(/^\\/api\\/v1\\/chats\\/([^/]+)$/) && method === 'GET')",
      "if (path === '/api/v1/chats/save' && method === 'POST')",
      "if (path === '/api/v1/codebase/runs' && method === 'GET')",
      "if (path === '/api/v1/codebase/runs' && method === 'POST')",
      "if (path.match(/^\\/api\\/v1\\/codebase\\/runs\\/([^/]+)$/) && method === 'GET')",
      "if (path.match(/^\\/api\\/v1\\/codebase\\/runs\\/([^/]+)\\/events$/) && method === 'GET')",
      "if (path.match(/^\\/api\\/v1\\/codebase\\/runs\\/([^/]+)\\/events\\/stream$/) && method === 'GET')",
      "if (path.match(/^\\/api\\/v1\\/codebase\\/runs\\/([^/]+)\\/cancel$/) && method === 'POST')",
      "if (path === '/api/v1/realtime/token' && method === 'POST')"
    ];

    expect(getRunEventsStreamUrl('run_123')).toBe('/api/v1/codebase/runs/run_123/events/stream');

    for (const snippet of requiredRouteSnippets) {
      expect(workerRouterSource).toContain(snippet);
    }
  });
});
