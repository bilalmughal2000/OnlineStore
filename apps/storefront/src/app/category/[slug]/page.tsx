import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { ListingControls } from '@/components/ListingControls';
import { Pagination } from '@/components/Pagination';

type SearchParams = Record<string, string | undefined>;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const { category } = await api.category(params.slug);
    return { title: category.name, description: `Shop ${category.name} online in Pakistan.` };
  } catch {
    return { title: 'Category' };
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: SearchParams;
}) {
  let category;
  try {
    category = (await api.category(params.slug)).category;
  } catch {
    notFound();
  }

  const query = new URLSearchParams({ category: params.slug });
  for (const key of ['sort', 'size', 'color', 'onSale', 'inStock', 'minPrice', 'maxPrice', 'page']) {
    if (searchParams[key]) query.set(key, searchParams[key]!);
  }

  const { items, total, page, totalPages } = await api.products(query.toString());

  return (
    <div className="container-x py-8">
      <nav className="mb-2 text-sm text-ink/50">
        Home / <span className="text-ink">{category!.name}</span>
      </nav>
      <h1 className="mb-6 font-serif text-3xl font-bold">{category!.name}</h1>

      <ListingControls total={total} />

      {items.length === 0 ? (
        <p className="py-16 text-center text-ink/60">No products match your filters.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        baseParams={Object.fromEntries(Object.entries(searchParams).filter(([, v]) => v) as [string, string][])}
      />
    </div>
  );
}
