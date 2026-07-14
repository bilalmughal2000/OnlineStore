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
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  wishlist: Set<string>;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadWishlist = useCallback(async () => {
    try {
      const { items } = await clientApi.get<{ items: { productId: string }[] }>('/account/wishlist');
      setWishlist(new Set(items.map((i) => i.productId)));
    } catch {
      setWishlist(new Set());
    }
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
          await loadWishlist();
        } catch {
          tokenStore.clear();
        }
      }
      await refreshCart();
      setLoading(false);
    })();
  }, [refreshCart, loadWishlist]);

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
      await loadWishlist();
    },
    [refreshCart, loadWishlist],
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
    setWishlist(new Set());
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

  const applyCoupon = useCallback(async (code: string) => {
    // Throws ApiError with the reason if invalid — caller surfaces it.
    const c = await clientApi.post<Cart>('/cart/coupon', { code });
    setCart(c);
  }, []);

  const removeCoupon = useCallback(async () => {
    const c = await clientApi.del<Cart>('/cart/coupon');
    setCart(c);
  }, []);

  const isWishlisted = useCallback((productId: string) => wishlist.has(productId), [wishlist]);

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!user) {
        showToast('Please log in to save items');
        return;
      }
      const adding = !wishlist.has(productId);
      // Optimistic update for instant heart feedback.
      setWishlist((prev) => {
        const next = new Set(prev);
        adding ? next.add(productId) : next.delete(productId);
        return next;
      });
      try {
        if (adding) await clientApi.post('/account/wishlist', { productId });
        else await clientApi.del(`/account/wishlist/${productId}`);
        showToast(adding ? 'Saved to wishlist' : 'Removed from wishlist');
      } catch {
        // Revert on failure.
        setWishlist((prev) => {
          const next = new Set(prev);
          adding ? next.delete(productId) : next.add(productId);
          return next;
        });
        showToast('Could not update wishlist');
      }
    },
    [user, wishlist, showToast],
  );

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
      applyCoupon,
      removeCoupon,
      wishlist,
      isWishlisted,
      toggleWishlist,
    }),
    [user, cart, loading, toast, showToast, login, register, logout, refreshCart, addToCart, updateQty, removeItem, applyCoupon, removeCoupon, wishlist, isWishlisted, toggleWishlist],
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
