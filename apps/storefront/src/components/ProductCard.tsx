'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import type { Product } from '@/lib/types';
import { discountPct, effectivePrice, formatPKR } from '@/lib/format';
import { useStore } from '@/providers/StoreProvider';

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useStore();
  const primary = product.images.find((i) => i.isPrimary) ?? product.images[0];
  const pct = discountPct(product);
  const inStock = product.variants.some((v) => v.stock > 0);
  const firstAvailable = product.variants.find((v) => v.stock > 0);

  const isNew = product.isFeatured;

  return (
    <div className="group relative flex flex-col">
      <Link href={`/product/${product.slug}`} className="relative block overflow-hidden rounded-lg bg-black/5">
        <div className="aspect-[4/5] relative">
          {primary && (
            <Image
              src={primary.url}
              alt={primary.alt ?? product.title}
              fill
              sizes="(max-width:768px) 50vw, 25vw"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          )}
        </div>
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {pct && <span className="badge bg-sale text-white">-{pct}%</span>}
          {isNew && <span className="badge bg-ink text-white">New</span>}
          {!inStock && <span className="badge bg-black/60 text-white">Sold out</span>}
        </div>
      </Link>

      <div className="mt-3 flex flex-1 flex-col">
        {product.brand && <p className="text-xs uppercase tracking-wide text-ink/50">{product.brand}</p>}
        <Link href={`/product/${product.slug}`} className="line-clamp-1 text-sm font-medium hover:text-accent">
          {product.title}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-semibold">{formatPKR(effectivePrice(product))}</span>
          {product.salePrice && (
            <span className="text-sm text-ink/40 line-through">{formatPKR(product.basePrice)}</span>
          )}
        </div>

        <button
          type="button"
          disabled={!inStock || !firstAvailable}
          onClick={() => firstAvailable && addToCart(firstAvailable.id, 1)}
          className="btn-outline mt-3 w-full text-xs opacity-0 transition group-hover:opacity-100 disabled:opacity-40"
        >
          <ShoppingBag size={14} /> Quick add
        </button>
      </div>
    </div>
  );
}
