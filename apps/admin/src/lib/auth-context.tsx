import { createContext, useContext, useEffect, useState } from 'react';
import { api, auth } from './api';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
}

interface AuthState {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.access()) return setLoading(false);
    api
      .get<{ user: AdminUser }>('/auth/me')
      .then(({ user }) => {
        if (user.role === 'ADMIN' || user.role === 'STAFF') setUser(user);
        else auth.clear();
      })
      .catch(() => auth.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ user: AdminUser; accessToken: string; refreshToken: string }>('/auth/login', {
      email,
      password,
    });
    if (data.user.role !== 'ADMIN' && data.user.role !== 'STAFF') {
      throw new Error('This account does not have admin access');
    }
    auth.set(data.accessToken, data.refreshToken);
    setUser(data.user);
  };

  const logout = () => {
    auth.clear();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
