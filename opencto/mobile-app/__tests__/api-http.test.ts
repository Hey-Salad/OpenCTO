import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/http';

describe('ApiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injects bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient(async () => 'abc123');
    await client.request('/test');

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer abc123');
  });
});
