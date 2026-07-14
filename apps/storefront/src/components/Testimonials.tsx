import Link from 'next/link';
import { Star, Quote } from 'lucide-react';
import type { Testimonial } from '@/lib/types';

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export function Testimonials({ items }: { items: Testimonial[] }) {
  if (!items?.length) return null;

  return (
    <section className="rounded-2xl bg-ink px-5 py-10 text-white md:px-10">
      <div className="mb-8 text-center">
        <h2 className="font-serif text-2xl font-bold md:text-3xl">Loved by our customers</h2>
        <p className="mt-1 text-white/60">Real 5-star reviews from shoppers across Pakistan</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.slice(0, 6).map((t) => (
          <figure key={t.id} className="flex flex-col rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
            <Quote className="text-accent-light" size={22} />
            <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-white/90">{t.comment}</blockquote>
            <div className="mt-3 flex text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={14} fill="currentColor" />
              ))}
            </div>
            <figcaption className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xs font-semibold">
                {initials(t.user?.name ?? 'A')}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.user?.name ?? 'Verified Buyer'}</p>
                {t.product && (
                  <Link href={`/product/${t.product.slug}`} className="line-clamp-1 text-xs text-white/50 hover:text-white">
                    on {t.product.title}
                  </Link>
                )}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
