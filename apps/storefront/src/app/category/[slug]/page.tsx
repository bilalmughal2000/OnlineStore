import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { absoluteUrl } from '@/lib/site';
import { ProductCard } from '@/components/ProductCard';
import { ListingControls } from '@/components/ListingControls';
import { ListingAnalytics } from '@/components/ListingAnalytics';
import { CategorySidebar } from '@/components/CategorySidebar';
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
  let data: Awaited<ReturnType<typeof api.category>>;
  try {
    data = await api.category(params.slug);
  } catch {
    notFound(); // returns never — `data` is always assigned past this point
  }
  // `branch` is the whole top-level tree this category sits in; `ancestors` is
  // the path down to it. Together they drive the sidebar and the breadcrumbs.
  const { category, ancestors, branch } = data;

  const query = new URLSearchParams({ category: params.slug });
  for (const key of ['sort', 'size', 'color', 'onSale', 'inStock', 'minPrice', 'maxPrice', 'page']) {
    if (searchParams[key]) query.set(key, searchParams[key]!);
  }

  const { items, total, page, totalPages } = await api.products(query.toString());

  const trail = [...ancestors, category];
  const subcategories = category.children ?? [];

  // BreadcrumbList markup renders the category path in Google results instead
  // of a raw URL, which measurably improves click-through. Nested categories
  // contribute their real ancestry rather than a flat Home → Category hop.
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      ...trail.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: c.name,
        item: absoluteUrl(`/category/${c.slug}`),
      })),
    ],
  };

  return (
    <div className="container-x py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <ListingAnalytics items={items} listName={category.name} />

      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-sm text-ink/50">
        <Link href="/" className="hover:text-accent">
          Home
        </Link>
        {ancestors.map((a) => (
          <span key={a.id} className="flex items-center gap-1">
            <span aria-hidden>/</span>
            <Link href={`/category/${a.slug}`} className="hover:text-accent">
              {a.name}
            </Link>
          </span>
        ))}
        <span aria-hidden>/</span>
        <span className="text-ink">{category.name}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-serif text-3xl font-bold">{category.name}</h1>
        {subcategories.length > 0 && (
          <span className="text-sm text-ink/45">
            {subcategories.length} {subcategories.length === 1 ? 'subcategory' : 'subcategories'}
          </span>
        )}
      </div>
      {category.description && (
        <p className="-mt-3 mb-6 max-w-2xl text-sm leading-relaxed text-ink/60">{category.description}</p>
      )}

      <div className="flex flex-col lg:flex-row lg:gap-8">
        <CategorySidebar branch={branch} activeSlug={category.slug} trail={trail.map((c) => c.slug)} />

        <div className="min-w-0 flex-1">
          <ListingControls total={total} />

          {items.length === 0 ? (
            <p className="py-16 text-center text-ink/60">No products match your filters.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            baseParams={Object.fromEntries(
              Object.entries(searchParams).filter(([, v]) => v) as [string, string][],
            )}
          />
        </div>
      </div>
    </div>
  );
}
