import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import { HeroCarousel } from '@/components/HeroCarousel';
import { ProductCard } from '@/components/ProductCard';
import { Testimonials } from '@/components/Testimonials';
import type { Category, Product } from '@/lib/types';

export const revalidate = 60;

export default async function HomePage() {
  // Fail-safe: if the API is unreachable at build time (e.g. CI), still build a
  // valid (empty) page; ISR fills it in at runtime.
  let data: Awaited<ReturnType<typeof api.homepage>>;
  try {
    data = await api.homepage();
  } catch {
    data = { banners: [], sections: [], categories: [], testimonials: [] };
  }
  const { banners, sections, categories, testimonials } = data;

  return (
    <div>
      <HeroCarousel banners={banners} />

      <div className="container-x py-12 space-y-16">
        {sections.map((section) => {
          if (section.type === 'PRODUCT_GRID' && section.products?.length) {
            return <ProductGrid key={section.id} title={section.title} products={section.products} />;
          }
          if (section.type === 'CATEGORY_TILES') {
            return (
              <CategoryTiles key={section.id} title={section.title} categories={section.categories ?? categories} />
            );
          }
          return null;
        })}

        <Testimonials items={testimonials} />
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <h2 className="font-serif text-2xl font-bold md:text-3xl">{title}</h2>
    </div>
  );
}

function ProductGrid({ title, products }: { title: string; products: Product[] }) {
  return (
    <section>
      <SectionHeader title={title} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

function CategoryTiles({ title, categories }: { title: string; categories: Category[] }) {
  return (
    <section>
      <SectionHeader title={title} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/category/${c.slug}`}
            className="group relative aspect-square overflow-hidden rounded-lg bg-black/5"
          >
            {c.image && (
              <Image
                src={c.image}
                alt={c.name}
                fill
                sizes="(max-width:768px) 50vw, 20vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-4">
              <span className="font-serif text-lg font-semibold text-white">{c.name}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
