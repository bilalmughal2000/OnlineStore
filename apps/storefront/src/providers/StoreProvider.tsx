'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clientApi, tokenStore } from '@/lib/client-api';
import {
  trackAddToCart,
  trackAddToWishlist,
  trackRemoveFromCart,
  type AnalyticsItem,
} from '@/lib/analytics';
import { clearGuestWishlist, readGuestWishlist, toggleGuestWishlist } from '@/lib/guest-wishlist';
import type { AuthUser, Cart, CartLine } from '@/lib/types';

interface StoreState {
  user: AuthUser | null;
  cart: Cart | null;
  loading: boolean;
  cartCount: number;
  toast: string | null;
  showToast: (msg: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; phone?: string; password: string }) => Promise<void>;
  // Turns a completed guest order into an account and signs the buyer in.
  claimGuestOrder: (orderId: string, token: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshCart: () => Promise<void>;
  addToCart: (variantId: string, quantity?: number) => Promise<void>;
  updateQty: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  wishlist: Set<string>;
  isWishlisted: (productId: string) => boolean;
  // `meta` is optional and analytics-only: it lets the AddToWishlist event carry
  // a name and price. Omitting it still toggles the wishlist correctly.
  toggleWishlist: (productId: string, meta?: { name: string; price: number }) => Promise<void>;
}

const StoreContext = createContext<StoreState | null>(null);

// Cart lines already carry title/price/variant, so analytics events are built
// from the server's authoritative response rather than from component props —
// the reported revenue then always matches what was actually charged.
const lineToItem = (line: CartLine, quantity?: number): AnalyticsItem => ({
  id: line.productId,
  name: line.productTitle,
  price: line.unitPrice,
  quantity: quantity ?? line.quantity,
  variant: line.variantLabel,
});

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
          // Token was stale — fall back to whatever this browser saved as a guest.
          setWishlist(new Set(readGuestWishlist()));
        }
      } else {
        setWishlist(new Set(readGuestWishlist()));
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
      // Carry anything hearted while browsing as a guest into the account, then
      // drop the local copy so the two can't drift apart.
      const guestSaved = readGuestWishlist();
      if (guestSaved.length) {
        await Promise.allSettled(
          guestSaved.map((productId) => clientApi.post('/account/wishlist', { productId })),
        );
        clearGuestWishlist();
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

  const claimGuestOrder = useCallback(
    async (orderId: string, token: string, password: string) => {
      const data = await clientApi.post<any>(
        `/orders/${orderId}/claim?token=${encodeURIComponent(token)}`,
        { password },
      );
      // Same post-auth handling as login/register, so the header, wishlist and
      // cart all reflect the new session immediately.
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
      // Report only the quantity just added, not the line's new total — adding
      // a 2nd unit to an existing line is one add_to_cart of quantity 1.
      const line = c.lines.find((l) => l.variantId === variantId);
      if (line) trackAddToCart(lineToItem(line, quantity));
      showToast('Added to cart');
    },
    [showToast],
  );

  const updateQty = useCallback(async (variantId: string, quantity: number) => {
    const c = await clientApi.patch<Cart>(`/cart/items/${variantId}`, { quantity });
    setCart(c);
  }, []);

  const removeItem = useCallback(
    async (variantId: string) => {
      // Capture the line before it's gone — the response no longer contains it.
      const removed = cart?.lines.find((l) => l.variantId === variantId);
      const c = await clientApi.del<Cart>(`/cart/items/${variantId}`);
      setCart(c);
      if (removed) trackRemoveFromCart(lineToItem(removed));
    },
    [cart],
  );

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
    async (productId: string, meta?: { name: string; price: number }) => {
      const adding = !wishlist.has(productId);

      // Guests keep their wishlist in the browser. Blocking them behind a login
      // wall loses the save — and the intent behind it — for no benefit; the
      // list is merged into their account if they ever sign up.
      if (!user) {
        setWishlist(new Set(toggleGuestWishlist(productId)));
        if (adding && meta) trackAddToWishlist({ id: productId, name: meta.name, price: meta.price });
        showToast(adding ? 'Saved to wishlist' : 'Removed from wishlist');
        return;
      }

      // Optimistic update for instant heart feedback.
      setWishlist((prev) => {
        const next = new Set(prev);
        adding ? next.add(productId) : next.delete(productId);
        return next;
      });
      try {
        if (adding) await clientApi.post('/account/wishlist', { productId });
        else await clientApi.del(`/account/wishlist/${productId}`);
        if (adding && meta) trackAddToWishlist({ id: productId, name: meta.name, price: meta.price });
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
      claimGuestOrder,
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
    [user, cart, loading, toast, showToast, login, register, claimGuestOrder, logout, refreshCart, addToCart, updateQty, removeItem, applyCoupon, removeCoupon, wishlist, isWishlisted, toggleWishlist],
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
