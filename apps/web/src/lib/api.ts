import type { ApiErrorBody } from '@app/types';

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    public readonly body: ApiErrorBody,
    public readonly status: number,
  ) {
    super(body?.message ?? 'Request failed');
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      credentials: 'include',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(
      { code: 'INTERNAL', message: 'Could not reach the server. Is the API running?' },
      0,
    );
  }
  // Transparent refresh: the 15-minute access token expires silently; try once.
  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    const refreshed = await fetch(BASE + '/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    }).then((r) => r.ok).catch(() => false);
    if (refreshed) return request<T>(path, init, true);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const body = (data as ApiErrorBody) ?? { code: 'INTERNAL', message: 'Request failed' };
    throw new ApiError(body, res.status);
  }
  return data as T;
}

export function qs(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
