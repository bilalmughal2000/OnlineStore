import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
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
    return {
      title: product.title,
      description: plainText(product.description).slice(0, 155),
      openGraph: { images: product.images[0] ? [product.images[0].url] : [] },
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

  // schema.org structured data for SEO (Section 8).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: product.images.map((i) => i.url),
    description: plainText(product.description),
    brand: product.brand ?? undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'PKR',
      price: effectivePrice(product),
      availability: product.variants.some((v) => v.stock > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <div className="container-x py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
