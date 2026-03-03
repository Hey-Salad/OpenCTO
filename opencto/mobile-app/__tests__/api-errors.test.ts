import { describe, expect, it } from 'vitest';
import { normalizeApiError } from '@/api/errors';

describe('normalizeApiError', () => {
  it('maps status codes', () => {
    const error = normalizeApiError({ status: 401 }, 'Unauthorized');
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.retriable).toBe(false);
  });

  it('maps network errors', () => {
    const error = normalizeApiError(new TypeError('failed'));
    expect(error.code).toBe('NETWORK');
    expect(error.retriable).toBe(true);
  });
});
