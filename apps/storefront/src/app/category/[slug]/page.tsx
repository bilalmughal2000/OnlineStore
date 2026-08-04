import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { absoluteUrl } from '@/lib/site';
import { ProductCard } from '@/components/ProductCard';
import { ListingControls } from '@/components/ListingControls';
import { ListingAnalytics } from '@/components/ListingAnalytics';
import { Pagination } from '@/components/Pagination';

type SearchParams = Record<string, string | undefined>;

// Filter/sort params produce near-duplicate pages of the same catalogue. Google
// should index the clean category URL only, so filtered views are noindex and
// every variant canonicalises back to the bare slug.
const FILTER_KEYS = ['sort', 'size', 'color', 'onSale', 'inStock', 'minPrice', 'maxPrice'] as const;
const isFiltered = (sp: SearchParams) => FILTER_KEYS.some((k) => sp[k]);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: SearchParams;
}): Promise<Metadata> {
  try {
    const { category } = await api.category(params.slug);
    const filtered = isFiltered(searchParams);
    const page = Number(searchParams.page ?? 1);
    return {
      title: category.name,
      description:
        category.description?.slice(0, 155) || `Shop ${category.name} online in Pakistan.`,
      // Page 2+ keeps its own canonical so paginated results stay crawlable
      // without collapsing into page 1.
      alternates: {
        canonical: page > 1 ? `/category/${params.slug}?page=${page}` : `/category/${params.slug}`,
      },
      robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
      openGraph: {
        title: category.name,
        images: category.image ? [category.image] : [],
        url: `/category/${params.slug}`,
      },
    };
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

  // BreadcrumbList markup renders the category path in Google results instead
  // of a raw URL, which measurably improves click-through.
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      {
        '@type': 'ListItem',
        position: 2,
        name: category!.name,
        item: absoluteUrl(`/category/${params.slug}`),
      },
    ],
  };

  return (
    <div className="container-x py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <ListingAnalytics items={items} listName={category!.name} />
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
