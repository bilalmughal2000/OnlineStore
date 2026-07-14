'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Heart, ShoppingBag } from 'lucide-react';
import type { Product } from '@/lib/types';
import { discountPct, effectivePrice, formatPKR } from '@/lib/format';
import { useStore } from '@/providers/StoreProvider';
import { ApiError } from '@/lib/client-api';

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, isWishlisted, showToast } = useStore();
  const [adding, setAdding] = useState(false);

  const primary = product.images.find((i) => i.isPrimary) ?? product.images[0];
  const secondary = product.images.find((i) => i.id !== primary?.id); // swaps in on hover
  const pct = discountPct(product);
  const firstAvailable = product.variants.find((v) => v.stock > 0);
  const inStock = Boolean(firstAvailable);
  const wl = isWishlisted(product.id);

  const handleQuickAdd = async () => {
    if (!firstAvailable) return;
    setAdding(true);
    try {
      await addToCart(firstAvailable.id, 1);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not add to cart');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="group relative flex flex-col">
      <div className="relative">
        <Link href={`/product/${product.slug}`} className="block overflow-hidden rounded-lg bg-black/5">
          <div className="aspect-[4/5] relative">
            {primary && (
              <Image
                src={primary.url}
                alt={primary.alt ?? product.title}
                fill
                sizes="(max-width:768px) 50vw, 25vw"
                className={`object-cover transition duration-500 group-hover:scale-105 ${secondary ? 'group-hover:opacity-0' : ''}`}
              />
            )}
            {secondary && (
              <Image
                src={secondary.url}
                alt={primary?.alt ?? product.title}
                fill
                sizes="(max-width:768px) 50vw, 25vw"
                className="object-cover opacity-0 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
              />
            )}
          </div>
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {pct && <span className="badge bg-sale text-white">-{pct}%</span>}
            {product.isFeatured && <span className="badge bg-ink text-white">New</span>}
            {!inStock && <span className="badge bg-black/60 text-white">Sold out</span>}
          </div>
        </Link>

        {/* Wishlist heart — toggles without leaving the listing page */}
        <button
          type="button"
          aria-label={wl ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wl}
          onClick={() => toggleWishlist(product.id)}
          className="absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:bg-white"
        >
          <Heart size={18} className={wl ? 'fill-sale text-sale' : 'text-ink/60'} />
        </button>
      </div>

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

        {/* Always visible on mobile; reveal on hover for desktop. */}
        <button
          type="button"
          disabled={!inStock || adding}
          onClick={handleQuickAdd}
          className="btn-outline mt-3 w-full text-xs transition disabled:opacity-40 lg:opacity-0 lg:group-hover:opacity-100"
        >
          <ShoppingBag size={14} /> {adding ? 'Adding…' : inStock ? 'Quick add' : 'Sold out'}
        </button>
      </div>
    </div>
  );
}
