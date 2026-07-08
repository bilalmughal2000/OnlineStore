import type { NextFunction, Request, Response } from 'express';

/**
 * Sets HTTP cache headers on public, cacheable GET endpoints so a CDN
 * (Cloudflare) and browsers can serve them without hitting the origin.
 * `s-maxage` targets the shared CDN cache; `stale-while-revalidate` keeps
 * responses snappy while a fresh copy is fetched in the background.
 *
 * Only applied to GET requests and never when an Authorization header is
 * present (personalised responses must not be cached).
 */
export function publicCache(maxAge = 60, sMaxAge = 300, swr = 600) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' && !req.headers.authorization) {
      res.setHeader(
        'Cache-Control',
        `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
      );
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  };
}
