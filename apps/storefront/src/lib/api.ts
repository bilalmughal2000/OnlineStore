// Server-side data fetching (used in Server Components). Public endpoints only.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// Tagged 'storefront' so an admin change can purge all cached storefront data
// on demand (see app/api/revalidate). revalidate is the fallback TTL.
async function get<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate, tags: ['storefront'] } });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

import type {
  Announcement,
  Banner,
  Category,
  HomepageSection,
  MenuNode,
  Product,
  Review,
  Testimonial,
} from './types';

export const api = {
  homepage: () =>
    get<{ banners: Banner[]; sections: HomepageSection[]; categories: Category[]; testimonials: Testimonial[] }>(
      '/content/homepage',
    ),
  menu: () => get<{ header: MenuNode[]; footer: any[] }>('/content/menu'),
  settings: () => get<{ settings: Record<string, any> }>('/content/settings'),
  // Short TTL: a sale banner that outlives its sale is worse than none at all.
  announcements: () => get<{ announcements: Announcement[] }>('/content/announcements', 30),
  categories: () => get<{ categories: Category[] }>('/categories'),
  // `ancestors` is the breadcrumb trail (root first); `branch` is the top-level
  // category with its whole subtree, which the listing sidebar renders.
  category: (slug: string) =>
    get<{ category: Category & { parent?: Category | null }; ancestors: Category[]; branch: Category }>(
      `/categories/${slug}`,
    ),
  products: (query: string) =>
    get<{ items: Product[]; total: number; page: number; totalPages: number }>(
      `/products?${query}`,
      30,
    ),
  product: (slug: string) =>
    get<{ product: Product & { reviews: Review[]; attributes: any[] }; related: Product[] }>(
      `/products/${slug}`,
      30,
    ),
  page: (slug: string) => get<{ page: { title: string; content: string } }>(`/content/pages/${slug}`),
  // Slugs + last-modified dates for app/sitemap.ts. Cached an hour — search
  // engines don't need this any fresher than that.
  sitemap: () =>
    get<{
      products: { slug: string; updatedAt: string }[];
      categories: { slug: string }[];
      pages: { slug: string; updatedAt: string }[];
    }>('/content/sitemap', 3600),
};
