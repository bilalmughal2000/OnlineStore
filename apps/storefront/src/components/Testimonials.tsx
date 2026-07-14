'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Star, Quote } from 'lucide-react';
import type { Testimonial } from '@/lib/types';

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

// Cards visible at once: 1 (mobile) / 2 (tablet) / 3 (desktop).
function useVisibleCount() {
  const [n, setN] = useState(3);
  useEffect(() => {
    const calc = () => setN(window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 3);
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return n;
}

export function Testimonials({ items }: { items: Testimonial[] }) {
  const visible = useVisibleCount();
  const [index, setIndex] = useState(0);
  const [transition, setTransition] = useState(true);
  const paused = useRef(false);

  const count = items?.length ?? 0;
  const canLoop = count > visible;
  // Clone the first `visible` cards at the end for a seamless infinite loop.
  const slides = canLoop ? [...items, ...items.slice(0, visible)] : items;

  // Auto-advance.
  useEffect(() => {
    if (!canLoop) return;
    const t = setInterval(() => {
      if (!paused.current) setIndex((i) => i + 1);
    }, 3500);
    return () => clearInterval(t);
  }, [canLoop, visible]);

  // Keep index sane if the viewport (visible count) changes.
  useEffect(() => {
    setIndex(0);
    setTransition(true);
  }, [visible]);

  // Re-enable the transition on the frame after a seamless snap-back.
  useEffect(() => {
    if (!transition) {
      const r = requestAnimationFrame(() => setTransition(true));
      return () => cancelAnimationFrame(r);
    }
  }, [transition]);

  const handleEnd = () => {
    if (index >= count) {
      setTransition(false); // jump back to the real first card without animating
      setIndex(0);
    }
  };

  if (!count) return null;

  const stepPct = 100 / visible;

  return (
    <section
      className="overflow-hidden rounded-2xl bg-ink px-5 py-10 text-white md:px-10"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <div className="mb-8 text-center">
        <h2 className="font-serif text-2xl font-bold md:text-3xl">Loved by our customers</h2>
        <p className="mt-1 text-white/60">Real 5-star reviews from shoppers across Pakistan</p>
      </div>

      <div className="overflow-hidden">
        <div
          className={`flex ${transition ? 'transition-transform duration-700 ease-in-out' : ''}`}
          style={{ transform: `translateX(-${index * stepPct}%)` }}
          onTransitionEnd={handleEnd}
        >
          {slides.map((t, i) => (
            <div key={i} className="shrink-0 px-2.5" style={{ width: `${stepPct}%` }}>
              <figure className="flex h-full flex-col rounded-xl bg-white/5 p-5 ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:bg-white/10">
                <Quote className="text-accent-light" size={22} />
                <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-white/90">{t.comment}</blockquote>
                <div className="mt-3 flex text-amber-400">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} size={14} fill="currentColor" />
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
            </div>
          ))}
        </div>
      </div>

      {canLoop && (
        <div className="mt-6 flex justify-center gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to testimonial ${i + 1}`}
              onClick={() => {
                setTransition(true);
                setIndex(i);
              }}
              className={`h-1.5 rounded-full transition-all ${index % count === i ? 'w-6 bg-accent-light' : 'w-1.5 bg-white/30'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
