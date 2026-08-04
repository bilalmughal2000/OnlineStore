'use client';

/**
 * Wishlist for shoppers without an account.
 *
 * Kept in localStorage rather than the database: a guest has no stable identity
 * beyond their browser, so a server-side row keyed on the guest session would
 * offer nothing extra while adding a round trip to every heart tap. Saving is
 * instant, works offline, and survives a refresh.
 *
 * On login the stored ids are pushed into the account and the local copy is
 * cleared — the same hand-off the guest cart already does via /cart/merge.
 */

const KEY = 'store_guest_wishlist';

export function readGuestWishlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* private mode / storage full — the wishlist just won't persist */
  }
}

/** Adds or removes an id. Returns the resulting list. */
export function toggleGuestWishlist(productId: string): string[] {
  const ids = readGuestWishlist();
  const next = ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId];
  write(next);
  return next;
}

export function clearGuestWishlist() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
