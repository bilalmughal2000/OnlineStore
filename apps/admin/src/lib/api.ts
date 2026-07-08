const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:4000/api';

const ACCESS = 'admin_access';
const REFRESH = 'admin_refresh';

export const auth = {
  access: () => localStorage.getItem(ACCESS),
  refresh: () => localStorage.getItem(REFRESH),
  set: (a: string, r: string) => {
    localStorage.setItem(ACCESS, a);
    localStorage.setItem(REFRESH, r);
  },
  clear: () => {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

async function req<T>(path: string, opts: { method?: string; body?: unknown; retry?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = auth.access();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && opts.retry !== false && auth.refresh()) {
    const r = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refresh() }),
    });
    if (r.ok) {
      const d = await r.json();
      auth.set(d.accessToken, d.refreshToken);
      return req<T>(path, { ...opts, retry: false });
    }
    auth.clear();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? 'Request failed');
  return data as T;
}

export const api = {
  get: <T>(p: string) => req<T>(p),
  post: <T>(p: string, body?: unknown) => req<T>(p, { method: 'POST', body }),
  put: <T>(p: string, body?: unknown) => req<T>(p, { method: 'PUT', body }),
  patch: <T>(p: string, body?: unknown) => req<T>(p, { method: 'PATCH', body }),
  del: <T>(p: string) => req<T>(p, { method: 'DELETE' }),
};
