import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';

/*
 * Web app manifest.
 *
 * Over 70% of this store's traffic is a phone, and "Add to home screen" is the
 * cheapest way back for a repeat customer — it needs a manifest to be offered at
 * all, and without one Android shows a generic bookmark instead of the store.
 *
 * The name follows the admin's store name so a rebrand doesn't leave a stale
 * label on someone's home screen. Icons in /public are plain placeholders:
 * replace icon-192.png / icon-512.png with the real logo when there is one.
 *
 * Deliberately no service worker. A shop's prices, stock and cart are the last
 * things that should be served from a stale cache, and Next already serves
 * hashed static assets with immutable caching, which is where the real win is.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let storeName = 'Aabroo';
  let tagline = 'Modern Pakistani fashion, delivered nationwide.';
  try {
    const { settings } = await api.settings();
    storeName = (settings?.store?.name as string) || storeName;
    tagline = (settings?.store?.tagline as string) || tagline;
  } catch {
    /* API down at build/request time — the defaults are fine */
  }

  return {
    name: storeName,
    short_name: storeName.split(' ')[0].slice(0, 12),
    description: tagline,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#faf7f2',
    theme_color: '#1c1917',
    lang: 'en-PK',
    categories: ['shopping', 'lifestyle'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Track an order', url: '/order-lookup' },
      { name: 'My orders', url: '/account/orders' },
      { name: 'Cart', url: '/cart' },
    ],
  };
}
