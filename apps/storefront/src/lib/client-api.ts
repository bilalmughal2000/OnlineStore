'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const ACCESS_KEY = 'store_access';
const REFRESH_KEY = 'store_refresh';
const GUEST_KEY = 'store_guest';

export const tokenStore = {
  access: () => (typeof window === 'undefined' ? null : localStorage.getItem(ACCESS_KEY)),
  refresh: () => (typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY)),
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
  guestId(): string {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = `guest_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  },
};

/** One field-level problem reported by the API's Zod validation. */
export interface ApiFieldIssue {
  /** Dotted path into the request body, e.g. "newAddress.phone". */
  path: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  /**
   * Per-field problems. The API always sends these for a validation failure,
   * alongside the generic "Validation failed" message — dropping them is why a
   * form can only say "something is wrong" instead of naming the field.
   */
  details: ApiFieldIssue[];

  constructor(status: number, message: string, details: ApiFieldIssue[] = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean; retry?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const access = tokenStore.access();
  if (access) headers.Authorization = `Bearer ${access}`;
  if (typeof window !== 'undefined') headers['x-guest-id'] = tokenStore.guestId();

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  // Try one silent refresh on 401.
  if (res.status === 401 && opts.retry !== false && tokenStore.refresh()) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, { ...opts, retry: false });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.message ?? 'Request failed',
      Array.isArray(data?.error?.details) ? data.error.details : [],
    );
  }
  return data as T;
}

async function tryRefresh(): Promise<boolean> {
  const refresh = tokenStore.refresh();
  if (!refresh) return false;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) {
    tokenStore.clear();
    return false;
  }
  const data = await res.json();
  tokenStore.set(data.accessToken, data.refreshToken);
  return true;
}

export const clientApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
