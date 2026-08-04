import rateLimit from 'express-rate-limit';

// Tighter limits on auth + checkout per the security requirements (Section 8).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' } },
});

export const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many checkout attempts.' } },
});

// Blanket per-IP backstop against abuse. Cached public catalog/content GETs are
// exempt: they're cheap, Redis/CDN-cached, and (critically) all storefront SSR
// requests reach them from the Next server's single IP — a per-IP cap there
// would throttle the whole storefront. Sensitive routes keep their own strict
// limiters (authLimiter, checkoutLimiter).
const CACHED_PUBLIC_PREFIXES = ['/api/products', '/api/categories', '/api/content'];

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.method === 'GET' && CACHED_PUBLIC_PREFIXES.some((p) => req.path.startsWith(p)),
});

// Reviews are open to anyone (no account, no purchase), so a per-IP cap is the
// only thing standing between the ratings and a spam script.
export const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many reviews. Please try again later.' } },
});
