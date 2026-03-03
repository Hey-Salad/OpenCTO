import { ApiError } from '@/types/models';

const byStatus = (status?: number): Omit<ApiError, 'message'> => {
  if (!status) {
    return { code: 'UNKNOWN', retriable: false };
  }
  if (status === 401) {
    return { code: 'UNAUTHORIZED', retriable: false, status };
  }
  if (status === 403) {
    return { code: 'FORBIDDEN', retriable: false, status };
  }
  if (status === 404) {
    return { code: 'NOT_FOUND', retriable: false, status };
  }
  if (status >= 500) {
    return { code: 'SERVER', retriable: true, status };
  }
  return { code: 'UNKNOWN', retriable: false, status };
};

export const normalizeApiError = (error: unknown, fallbackMessage = 'Request failed'): ApiError => {
  if (typeof error === 'object' && error && 'code' in error && 'message' in error) {
    return error as ApiError;
  }

  if (error instanceof TypeError) {
    return {
      code: 'NETWORK',
      message: 'Network error. Check your connection and retry.',
      retriable: true
    };
  }

  if (typeof error === 'object' && error && 'status' in error) {
    const status = Number((error as { status?: number }).status);
    const mapped = byStatus(status);
    return {
      ...mapped,
      message: fallbackMessage
    };
  }

  return {
    code: 'UNKNOWN',
    message: fallbackMessage,
    retriable: false
  };
};
