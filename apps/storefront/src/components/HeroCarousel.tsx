'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Banner } from '@/lib/types';

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!banners.length) return null;
  const b = banners[i];

  return (
    <section className="relative">
      <div className="relative aspect-[16/7] w-full overflow-hidden bg-black/5 md:aspect-[16/6]">
        <Image src={b.imageUrl} alt={b.title ?? 'Banner'} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 flex items-center bg-gradient-to-r from-black/50 to-transparent">
          <div className="container-x">
            <div className="max-w-md text-white">
              {b.title && <h1 className="font-serif text-3xl font-bold md:text-5xl">{b.title}</h1>}
              {b.subtitle && <p className="mt-2 text-base text-white/90 md:text-lg">{b.subtitle}</p>}
              {b.link && (
                <Link href={b.link} className="btn-primary mt-5">
                  {b.ctaLabel || 'Shop Now'}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all ${idx === i ? 'w-6 bg-white' : 'w-2 bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
