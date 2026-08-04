import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { absoluteUrl } from '@/lib/site';
import { ProductDetail } from '@/components/ProductDetail';
import { ProductReviews } from '@/components/ProductReviews';
import { ProductCard } from '@/components/ProductCard';
import { effectivePrice } from '@/lib/format';

// Descriptions are HTML (rich text) — strip tags for meta/structured data.
const plainText = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const { product } = await api.product(params.slug);
    const description = plainText(product.description).slice(0, 155);
    return {
      title: product.seoTitle || product.title,
      description: product.seoDescription || description,
      alternates: { canonical: `/product/${params.slug}` },
      openGraph: {
        type: 'website',
        title: product.title,
        description,
        url: `/product/${params.slug}`,
        images: product.images[0] ? [product.images[0].url] : [],
      },
    };
  } catch {
    return { title: 'Product' };
  }
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  let data;
  try {
    data = await api.product(params.slug);
  } catch {
    notFound();
  }
  const { product, related } = data!;

  const inStock = product.variants.some((v) => v.stock > 0);

  // schema.org structured data for SEO (Section 8). Google uses this to render
  // rich product results: price, availability, and review stars.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: product.images.map((i) => i.url),
    description: plainText(product.description),
    sku: product.sku ?? undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    material: product.fabric ?? undefined,
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/product/${product.slug}`),
      priceCurrency: 'PKR',
      price: effectivePrice(product),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
    // Only emit when real reviews exist — Google rejects (and can penalise)
    // aggregateRating with a zero count.
    aggregateRating:
      product.ratingCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAvg.toFixed(1),
            reviewCount: product.ratingCount,
          }
        : undefined,
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      ...(product.category
        ? [
            {
              '@type': 'ListItem',
              position: 2,
              name: product.category.name,
              item: absoluteUrl(`/category/${product.category.slug}`),
            },
          ]
        : []),
      {
        '@type': 'ListItem',
        position: product.category ? 3 : 2,
        name: product.title,
        item: absoluteUrl(`/product/${product.slug}`),
      },
    ],
  };

  return (
    <div className="container-x py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <ProductDetail product={product} />

      <ProductReviews
        productId={product.id}
        slug={product.slug}
        initialReviews={product.reviews ?? []}
        ratingAvg={product.ratingAvg}
        ratingCount={product.ratingCount}
      />

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-serif text-2xl font-bold">You may also like</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
