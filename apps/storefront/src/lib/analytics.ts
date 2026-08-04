// ─────────────────────────────────────────────────────────────────────────────
// Analytics fan-out: one call site per business event, two destinations
// (GA4 + Meta Pixel). Every function is a no-op when the corresponding env var
// is unset, so dev and self-hosted installs stay silent without extra guards.
//
// Naming follows each vendor's *canonical* event names, because both platforms
// only apply their built-in e-commerce reporting/optimisation to those exact
// strings — a custom name still records but can't be optimised against.
//   GA4:  view_item, add_to_cart, begin_checkout, purchase, search …
//   Meta: ViewContent, AddToCart, InitiateCheckout, Purchase, Search …
// ─────────────────────────────────────────────────────────────────────────────

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '';
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '';
export const ANALYTICS_ENABLED = Boolean(GA_ID || META_PIXEL_ID);

const CURRENCY = 'PKR';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { loaded?: boolean };
  }
}

export interface AnalyticsItem {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  category?: string | null;
  variant?: string | null;
  brand?: string | null;
}

// ── SDK readiness buffer ────────────────────────────────────────────────────
// Both tags load with next/script `afterInteractive`, which runs *after* React
// hydration — so a React effect that fires on mount (view_item on a PDP, for
// instance) can run while window.gtag/window.fbq are still undefined. Calling
// through optional chaining alone would silently drop those events, losing
// precisely the first-pageview conversions that matter most.
//
// So: dispatch immediately when the SDK is present, otherwise queue in arrival
// order and flush as soon as it appears. Bounded so a blocked script (ad-blocker)
// can't leave a timer running for the life of the session.
type Target = 'ga' | 'fb';

const sdk = (t: Target) => (t === 'ga' ? window.gtag : window.fbq);

const pending: { target: Target; args: unknown[] }[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
const FLUSH_INTERVAL_MS = 200;
const MAX_FLUSH_ATTEMPTS = 50; // ~10s, then give up and drop the queue.

function flushPending() {
  for (let i = 0; i < pending.length; ) {
    const p = pending[i];
    const fn = sdk(p.target);
    if (!fn) {
      i++; // SDK still missing — keep it queued, preserving order.
      continue;
    }
    pending.splice(i, 1);
    try {
      fn(...p.args);
    } catch {
      /* best-effort */
    }
  }
}

function scheduleFlush() {
  if (flushTimer !== null) return;
  let attempts = 0;
  flushTimer = setInterval(() => {
    attempts++;
    flushPending();
    if (pending.length === 0 || attempts >= MAX_FLUSH_ATTEMPTS) {
      clearInterval(flushTimer!);
      flushTimer = null;
      pending.length = 0;
    }
  }, FLUSH_INTERVAL_MS);
}

// Vendor SDKs must never break the storefront: a blocked script, an ad-blocker,
// or a malformed payload should cost us a datapoint, not the user's checkout.
function dispatch(target: Target, args: unknown[]) {
  if (typeof window === 'undefined') return;
  // Skip entirely when that destination isn't configured, so nothing queues up
  // waiting for an SDK that will never load.
  if (target === 'ga' && !GA_ID) return;
  if (target === 'fb' && !META_PIXEL_ID) return;

  const fn = sdk(target);
  if (fn) {
    try {
      fn(...args);
    } catch {
      /* best-effort */
    }
    return;
  }
  pending.push({ target, args });
  scheduleFlush();
}

const gtag = (...args: unknown[]) => dispatch('ga', args);
const fbq = (...args: unknown[]) => dispatch('fb', args);

const ga4Items = (items: AnalyticsItem[]) =>
  items.map((i) => ({
    item_id: i.id,
    item_name: i.name,
    item_brand: i.brand ?? undefined,
    item_category: i.category ?? undefined,
    item_variant: i.variant ?? undefined,
    price: i.price,
    quantity: i.quantity ?? 1,
  }));

const metaContents = (items: AnalyticsItem[]) =>
  items.map((i) => ({ id: i.id, quantity: i.quantity ?? 1, item_price: i.price }));

const sumValue = (items: AnalyticsItem[]) =>
  items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);

// ── Page views ──────────────────────────────────────────────────────────────
// The App Router does client-side navigation, which fires no document load, so
// neither SDK auto-tracks route changes. AnalyticsProvider calls this instead.
export function trackPageView(url: string) {
  if (GA_ID) gtag('config', GA_ID, { page_path: url });
  if (META_PIXEL_ID) fbq('track', 'PageView');
}

// ── Catalogue ───────────────────────────────────────────────────────────────
export function trackViewItem(item: AnalyticsItem) {
  gtag('event', 'view_item', { currency: CURRENCY, value: item.price, items: ga4Items([item]) });
  fbq('track', 'ViewContent', {
    content_ids: [item.id],
    content_name: item.name,
    content_type: 'product',
    content_category: item.category ?? undefined,
    value: item.price,
    currency: CURRENCY,
  });
}

export function trackViewItemList(items: AnalyticsItem[], listName: string) {
  if (items.length === 0) return;
  gtag('event', 'view_item_list', { item_list_name: listName, items: ga4Items(items) });
  // Meta has no first-class list event; ViewCategory is the documented analogue.
  fbq('trackCustom', 'ViewCategory', {
    content_category: listName,
    content_ids: items.map((i) => i.id),
    content_type: 'product',
  });
}

export function trackSearch(term: string, resultCount?: number) {
  if (!term) return;
  gtag('event', 'search', { search_term: term, ...(resultCount != null && { results: resultCount }) });
  fbq('track', 'Search', { search_string: term, content_type: 'product' });
}

// ── Cart & checkout ─────────────────────────────────────────────────────────
export function trackAddToCart(item: AnalyticsItem) {
  const value = item.price * (item.quantity ?? 1);
  gtag('event', 'add_to_cart', { currency: CURRENCY, value, items: ga4Items([item]) });
  fbq('track', 'AddToCart', {
    content_ids: [item.id],
    content_name: item.name,
    content_type: 'product',
    contents: metaContents([item]),
    value,
    currency: CURRENCY,
  });
}

export function trackRemoveFromCart(item: AnalyticsItem) {
  gtag('event', 'remove_from_cart', {
    currency: CURRENCY,
    value: item.price * (item.quantity ?? 1),
    items: ga4Items([item]),
  });
}

export function trackViewCart(items: AnalyticsItem[], value?: number) {
  if (items.length === 0) return;
  gtag('event', 'view_cart', { currency: CURRENCY, value: value ?? sumValue(items), items: ga4Items(items) });
}

export function trackAddToWishlist(item: AnalyticsItem) {
  gtag('event', 'add_to_wishlist', { currency: CURRENCY, value: item.price, items: ga4Items([item]) });
  fbq('track', 'AddToWishlist', {
    content_ids: [item.id],
    content_name: item.name,
    content_type: 'product',
    value: item.price,
    currency: CURRENCY,
  });
}

export function trackBeginCheckout(items: AnalyticsItem[], value: number, coupon?: string | null) {
  if (items.length === 0) return;
  gtag('event', 'begin_checkout', {
    currency: CURRENCY,
    value,
    coupon: coupon ?? undefined,
    items: ga4Items(items),
  });
  fbq('track', 'InitiateCheckout', {
    content_ids: items.map((i) => i.id),
    content_type: 'product',
    contents: metaContents(items),
    num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0),
    value,
    currency: CURRENCY,
  });
}

export interface PurchasePayload {
  orderId: string;
  orderNumber: string;
  value: number;
  items: AnalyticsItem[];
  shipping?: number;
  tax?: number;
  coupon?: string | null;
  paymentMethod?: string;
}

export function trackPurchase(p: PurchasePayload) {
  gtag('event', 'purchase', {
    transaction_id: p.orderNumber,
    currency: CURRENCY,
    value: p.value,
    shipping: p.shipping,
    tax: p.tax,
    coupon: p.coupon ?? undefined,
    payment_type: p.paymentMethod,
    items: ga4Items(p.items),
  });
  // eventID must match the `event_id` the API sends to the Conversions API for
  // the same order, or Meta counts one sale twice. See apps/api/src/lib/meta-capi.ts.
  fbq(
    'track',
    'Purchase',
    {
      content_ids: p.items.map((i) => i.id),
      content_type: 'product',
      contents: metaContents(p.items),
      num_items: p.items.reduce((s, i) => s + (i.quantity ?? 1), 0),
      value: p.value,
      currency: CURRENCY,
    },
    { eventID: purchaseEventId(p.orderId) },
  );
}

// Single source of truth for the dedup key, shared conceptually with the API.
export const purchaseEventId = (orderId: string) => `purchase_${orderId}`;

// ── Server-side attribution hand-off ────────────────────────────────────────
const readCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
};

const FBCLID_KEY = 'aabroo:fbclid';
// Meta attributes clicks for up to 90 days, matching the _fbc cookie lifetime.
const FBCLID_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Records the ad click that started this session.
 *
 * `fbclid` is only ever present in the URL of the *landing* page. By the time
 * the visitor reaches checkout it is long gone, so reading it there finds
 * nothing. Normally the Pixel would have stashed it in an `_fbc` cookie — but
 * when the Pixel is blocked (ad-blocker, iOS tracking prevention) that cookie
 * never gets written, and that is precisely the case the Conversions API exists
 * to cover. So we persist it ourselves on arrival, independently of the Pixel.
 *
 * Safe to call on every page load: it only writes when an fbclid is present.
 */
export function captureAdClick() {
  if (typeof window === 'undefined') return;
  try {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid');
    if (!fbclid) return;
    localStorage.setItem(FBCLID_KEY, JSON.stringify({ id: fbclid, ts: Date.now() }));
  } catch {
    /* storage unavailable (private mode) — attribution degrades, nothing breaks */
  }
}

/** Rebuilds Meta's `_fbc` value from the click we stored on arrival. */
function storedFbc(): string | undefined {
  try {
    const raw = localStorage.getItem(FBCLID_KEY);
    if (!raw) return undefined;
    const { id, ts } = JSON.parse(raw) as { id: string; ts: number };
    if (!id || !ts || Date.now() - ts > FBCLID_TTL_MS) {
      localStorage.removeItem(FBCLID_KEY);
      return undefined;
    }
    // Meta's documented format: fb.<subdomainIndex>.<clickTimeMs>.<fbclid>
    return `fb.1.${ts}.${id}`;
  } catch {
    return undefined;
  }
}

/**
 * Meta's _fbp/_fbc cookies live on the storefront origin, so the API — a
 * different origin — never receives them. Checkout forwards them in its request
 * body so the Conversions API can attribute the sale to the ad that drove it.
 *
 * The Pixel's own cookies win when present; our stored click is the fallback.
 * `_fbp` is never fabricated — an id Meta has never seen adds no match value.
 */
export function checkoutAttribution(): { fbp?: string; fbc?: string; eventSourceUrl?: string } {
  if (typeof window === 'undefined') return {};
  return {
    fbp: readCookie('_fbp'),
    fbc: readCookie('_fbc') ?? storedFbc(),
    eventSourceUrl: window.location.href,
  };
}
