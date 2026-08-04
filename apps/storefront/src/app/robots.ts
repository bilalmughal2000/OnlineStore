import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  // Staging/preview deployments must never be indexed, or they compete with
  // the real domain for rankings and leak test data into search results.
  const isProd = process.env.NEXT_PUBLIC_SITE_URL && !/localhost|127\.0\.0\.1/.test(SITE_URL);
  if (!isProd) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private or valueless-to-index routes. Crawling these wastes crawl
        // budget and can surface a logged-out /account shell in results.
        disallow: ['/account', '/account/', '/cart', '/checkout', '/order-confirmation', '/login', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
