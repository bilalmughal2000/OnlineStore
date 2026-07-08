'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const SIZES = ['S', 'M', 'L', 'XL'];
const SORTS = [
  { v: 'newest', l: 'Newest' },
  { v: 'price_asc', l: 'Price: Low to High' },
  { v: 'price_desc', l: 'Price: High to Low' },
  { v: 'popularity', l: 'Popularity' },
  { v: 'rating', l: 'Top Rated' },
];

export function ListingControls({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
      next.delete('page'); // reset pagination on filter change
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  const current = (k: string) => params.get(k) ?? '';

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <span className="text-sm text-ink/60">{total} products</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <select
          value={current('size')}
          onChange={(e) => setParam('size', e.target.value || null)}
          className="select"
        >
          <option value="">All sizes</option>
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 rounded-md border border-ink/20 bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={current('onSale') === 'true'}
            onChange={(e) => setParam('onSale', e.target.checked ? 'true' : null)}
          />
          On sale
        </label>

        <label className="flex items-center gap-1.5 rounded-md border border-ink/20 bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={current('inStock') === 'true'}
            onChange={(e) => setParam('inStock', e.target.checked ? 'true' : null)}
          />
          In stock
        </label>

        <select
          value={current('sort') || 'newest'}
          onChange={(e) => setParam('sort', e.target.value)}
          className="select"
        >
          {SORTS.map((s) => (
            <option key={s.v} value={s.v}>
              {s.l}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
