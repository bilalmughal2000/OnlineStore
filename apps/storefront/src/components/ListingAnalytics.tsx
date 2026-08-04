'use client';

import { useEffect } from 'react';
import type { Product } from '@/lib/types';
import { effectivePrice } from '@/lib/format';
import { trackSearch, trackViewItemList } from '@/lib/analytics';

/**
 * Emits list-impression events for a Server Component listing page. Renders
 * nothing — it exists purely so category/search pages can stay server-rendered
 * (and therefore indexable) while still reporting client-side analytics.
 */
export function ListingAnalytics({
  items,
  listName,
  searchTerm,
  resultCount,
}: {
  items: Product[];
  listName: string;
  searchTerm?: string;
  resultCount?: number;
}) {
  // Re-fires when the listing changes — a new page, sort, or filter is a new
  // impression set, and Product ids are the meaningful identity here.
  const key = items.map((p) => p.id).join(',');

  useEffect(() => {
    if (searchTerm) trackSearch(searchTerm, resultCount);
    trackViewItemList(
      items.map((p) => ({
        id: p.id,
        name: p.title,
        price: effectivePrice(p),
        category: p.category?.name ?? null,
        brand: p.brand ?? null,
      })),
      listName,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, listName, searchTerm, resultCount]);

  return null;
}
