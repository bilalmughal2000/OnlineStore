// Canonical public origin of the storefront. Every absolute URL Google sees
// (canonicals, Open Graph images, sitemap entries) is built from this, so it
// MUST be the real https:// domain in production — a wrong value here makes
// Google index localhost URLs.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const absoluteUrl = (path = '/') => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
