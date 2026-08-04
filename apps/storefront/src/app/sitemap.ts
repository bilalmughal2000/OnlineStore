import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';
import { SITE_URL } from '@/lib/site';

// Re-generated hourly. Next serves this at /sitemap.xml; robots.ts points at it.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: 'weekly', priority: 0.3 },
  ];

  let dynamicEntries: MetadataRoute.Sitemap = [];
  try {
    const { products, categories, pages } = await api.sitemap();
    dynamicEntries = [
      // Category listings change as products move in and out of them.
      ...categories.map((c) => ({
        url: `${SITE_URL}/category/${c.slug}`,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })),
      // Products carry a real lastModified so crawlers can skip unchanged pages.
      ...products.map((p) => ({
        url: `${SITE_URL}/product/${p.slug}`,
        lastModified: new Date(p.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...pages.map((p) => ({
        url: `${SITE_URL}/page/${p.slug}`,
        lastModified: new Date(p.updatedAt),
        changeFrequency: 'monthly' as const,
        priority: 0.4,
      })),
    ];
  } catch {
    // API down at build/ISR time — still serve a valid sitemap with the static
    // routes rather than returning a 500 to the crawler.
  }

  return [...staticEntries, ...dynamicEntries];
}
