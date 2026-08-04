import Link from 'next/link';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { ListingAnalytics } from '@/components/ListingAnalytics';

export const dynamic = 'force-dynamic';

// Search result pages must not be indexed: they generate unbounded low-quality
// URLs that dilute crawl budget and can trigger thin-content penalties.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q ?? '';
  const { items, total } = q
    ? await api.products(new URLSearchParams({ search: q, pageSize: '24' }).toString())
    : { items: [], total: 0 };

  return (
    <div className="container-x py-8">
      {q && <ListingAnalytics items={items} listName={`Search: ${q}`} searchTerm={q} resultCount={total} />}
      <h1 className="mb-1 font-serif text-2xl font-bold">Search results</h1>
      <p className="mb-6 text-ink/60">
        {total} result{total === 1 ? '' : 's'} for “{q}”
      </p>

      {items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-ink/60">No products found.</p>
          <Link href="/" className="btn-primary mt-4">Browse all products</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
