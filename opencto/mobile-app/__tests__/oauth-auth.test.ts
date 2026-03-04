import { describe, expect, it } from 'vitest';
import {
  buildGitHubOAuthStartUrl,
  extractAuthTokenFromOAuthCallback,
  MOBILE_OAUTH_CALLBACK_URL
} from '@/auth/oauth';

describe('mobile oauth helpers', () => {
  it('builds GitHub OAuth start url with returnTo callback', () => {
    const url = buildGitHubOAuthStartUrl('https://api.opencto.works');
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://api.opencto.works');
    expect(parsed.pathname).toBe('/api/v1/auth/oauth/github/start');
    expect(parsed.searchParams.get('returnTo')).toBe(MOBILE_OAUTH_CALLBACK_URL);
  });

  it('extracts auth token from callback hash', () => {
    const token = extractAuthTokenFromOAuthCallback('opencto://auth/callback#auth_token=abc123');
    expect(token).toBe('abc123');
  });

  it('extracts auth token from callback query fallback', () => {
    const token = extractAuthTokenFromOAuthCallback('opencto://auth/callback?auth_token=xyz789');
    expect(token).toBe('xyz789');
  });

  it('returns null when callback has no auth token', () => {
    const token = extractAuthTokenFromOAuthCallback('opencto://auth/callback#state=missing');
    expect(token).toBeNull();
  });
});
