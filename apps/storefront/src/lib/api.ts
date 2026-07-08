// Server-side data fetching (used in Server Components). Public endpoints only.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

async function get<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate } });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

import type { Banner, Category, HomepageSection, Product } from './types';

export const api = {
  homepage: () =>
    get<{ banners: Banner[]; sections: HomepageSection[]; categories: Category[] }>(
      '/content/homepage',
    ),
  menu: () => get<{ header: any[]; footer: any[] }>('/content/menu'),
  settings: () => get<{ settings: Record<string, any> }>('/content/settings'),
  categories: () => get<{ categories: Category[] }>('/categories'),
  category: (slug: string) => get<{ category: Category & { parent?: Category } }>(`/categories/${slug}`),
  products: (query: string) =>
    get<{ items: Product[]; total: number; page: number; totalPages: number }>(
      `/products?${query}`,
      30,
    ),
  product: (slug: string) =>
    get<{ product: Product & { reviews: any[]; attributes: any[] }; related: Product[] }>(
      `/products/${slug}`,
      30,
    ),
  page: (slug: string) => get<{ page: { title: string; content: string } }>(`/content/pages/${slug}`),
};
