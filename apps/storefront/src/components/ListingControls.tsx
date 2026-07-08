'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Select } from '@/components/ui/Select';

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
        <Select
          className="w-36"
          ariaLabel="Filter by size"
          value={current('size')}
          onChange={(v) => setParam('size', v || null)}
          options={[{ value: '', label: 'All sizes' }, ...SIZES.map((s) => ({ value: s, label: s }))]}
        />

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

        <Select
          className="w-48"
          ariaLabel="Sort products"
          value={current('sort') || 'newest'}
          onChange={(v) => setParam('sort', v)}
          options={SORTS.map((s) => ({ value: s.v, label: s.l }))}
        />
      </div>
    </div>
  );
}
