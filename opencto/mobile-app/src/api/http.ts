import { API_BASE_URL } from '@/config/env';
import { ApiError } from '@/types/models';
import { normalizeApiError } from './errors';

export type GetToken = () => Promise<string | null>;

export interface RequestOptions extends RequestInit {
  retries?: number;
}

export class ApiClient {
  private readonly getToken: GetToken;

  constructor(getToken: GetToken) {
    this.getToken = getToken;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { retries = 0, ...init } = options;
    const token = await this.getToken();
    const headers = new Headers(init.headers ?? {});

    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const url = `${API_BASE_URL}${path}`;

    try {
      const response = await fetch(url, {
        ...init,
        headers
      });

      if (!response.ok) {
        const message = await this.readErrorMessage(response);
        const normalized: ApiError = normalizeApiError({ status: response.status }, message);
        if (normalized.retriable && retries > 0) {
          return this.request<T>(path, { ...options, retries: retries - 1 });
        }
        throw normalized;
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.retriable && retries > 0) {
        return this.request<T>(path, { ...options, retries: retries - 1 });
      }
      throw normalized;
    }
  }

  private async readErrorMessage(response: Response): Promise<string> {
    try {
      const body = await response.json();
      if (body?.error?.message) {
        return body.error.message;
      }
      if (body?.message) {
        return body.message;
      }
    } catch {
      // Ignore JSON parse errors and fallback below.
    }
    return `Request failed with status ${response.status}`;
  }
}
