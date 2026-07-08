'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clientApi, tokenStore } from '@/lib/client-api';
import type { AuthUser, Cart } from '@/lib/types';

interface StoreState {
  user: AuthUser | null;
  cart: Cart | null;
  loading: boolean;
  cartCount: number;
  toast: string | null;
  showToast: (msg: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; phone?: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshCart: () => Promise<void>;
  addToCart: (variantId: string, quantity?: number) => Promise<void>;
  updateQty: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      const c = await clientApi.get<Cart>('/cart');
      setCart(c);
    } catch {
      /* ignore */
    }
  }, []);

  // Bootstrap: load current user (if token) + cart.
  useEffect(() => {
    (async () => {
      if (tokenStore.access()) {
        try {
          const { user } = await clientApi.get<{ user: AuthUser }>('/auth/me');
          setUser(user);
        } catch {
          tokenStore.clear();
        }
      }
      await refreshCart();
      setLoading(false);
    })();
  }, [refreshCart]);

  const afterAuth = useCallback(
    async (data: { user: AuthUser; accessToken: string; refreshToken: string }) => {
      tokenStore.set(data.accessToken, data.refreshToken);
      setUser(data.user);
      // Merge guest cart into the user's cart.
      try {
        await clientApi.post('/cart/merge', { guestSessionId: tokenStore.guestId() });
      } catch {
        /* no guest cart to merge */
      }
      await refreshCart();
    },
    [refreshCart],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await clientApi.post<any>('/auth/login', { email, password });
      await afterAuth(data);
    },
    [afterAuth],
  );

  const register = useCallback(
    async (input: { name: string; email: string; phone?: string; password: string }) => {
      const data = await clientApi.post<any>('/auth/register', input);
      await afterAuth(data);
    },
    [afterAuth],
  );

  const logout = useCallback(async () => {
    try {
      await clientApi.post('/auth/logout', { refreshToken: tokenStore.refresh() });
    } catch {
      /* ignore */
    }
    tokenStore.clear();
    setUser(null);
    await refreshCart();
  }, [refreshCart]);

  const addToCart = useCallback(
    async (variantId: string, quantity = 1) => {
      const c = await clientApi.post<Cart>('/cart/items', { variantId, quantity });
      setCart(c);
      showToast('Added to cart');
    },
    [showToast],
  );

  const updateQty = useCallback(async (variantId: string, quantity: number) => {
    const c = await clientApi.patch<Cart>(`/cart/items/${variantId}`, { quantity });
    setCart(c);
  }, []);

  const removeItem = useCallback(async (variantId: string) => {
    const c = await clientApi.del<Cart>(`/cart/items/${variantId}`);
    setCart(c);
  }, []);

  const value = useMemo<StoreState>(
    () => ({
      user,
      cart,
      loading,
      cartCount: cart?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0,
      toast,
      showToast,
      login,
      register,
      logout,
      refreshCart,
      addToCart,
      updateQty,
      removeItem,
    }),
    [user, cart, loading, toast, showToast, login, register, logout, refreshCart, addToCart, updateQty, removeItem],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
