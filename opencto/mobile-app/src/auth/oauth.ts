export const MOBILE_OAUTH_CALLBACK_URL = 'opencto://auth/callback';

export const buildGitHubOAuthStartUrl = (
  apiBaseUrl: string,
  returnTo: string = MOBILE_OAUTH_CALLBACK_URL,
): string => {
  const normalizedBase = apiBaseUrl.replace(/\/+$/, '');
  const url = new URL(`${normalizedBase}/api/v1/auth/oauth/github/start`);
  url.searchParams.set('returnTo', returnTo);
  return url.toString();
};

export const extractAuthTokenFromOAuthCallback = (callbackUrl: string): string | null => {
  const [baseWithQuery, hashPart = ''] = callbackUrl.split('#');
  const hashParams = new URLSearchParams(hashPart);
  const fromHash = hashParams.get('auth_token')?.trim();
  if (fromHash) return fromHash;

  try {
    const parsed = new URL(baseWithQuery);
    const fromQuery = parsed.searchParams.get('auth_token')?.trim();
    return fromQuery || null;
  } catch {
    return null;
  }
};
