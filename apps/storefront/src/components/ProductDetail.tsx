'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Heart, Minus, Plus, Star, Truck } from 'lucide-react';
import type { Product } from '@/lib/types';
import { discountPct, effectivePrice, formatPKR } from '@/lib/format';
import { useStore } from '@/providers/StoreProvider';
import { ApiError } from '@/lib/client-api';
import { SizeChartModal } from './SizeChartModal';

type FullProduct = Product & { reviews?: any[] };

const TABS = ['Description', 'Size & Fit', 'Fabric & Care', 'Shipping & Returns'] as const;

export function ProductDetail({ product }: { product: FullProduct }) {
  const { addToCart, showToast, toggleWishlist, isWishlisted } = useStore();
  const wl = isWishlisted(product.id);

  const sizes = useMemo(
    () => [...new Set(product.variants.map((v) => v.size).filter(Boolean))] as string[],
    [product.variants],
  );
  const colors = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const v of product.variants) if (v.color) map.set(v.color, v.colorHex ?? null);
    return [...map.entries()].map(([name, hex]) => ({ name, hex }));
  }, [product.variants]);

  const [size, setSize] = useState<string | null>(sizes[0] ?? null);
  const [color, setColor] = useState<string | null>(colors[0]?.name ?? null);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Description');
  const [busy, setBusy] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const hasSizeChart = Boolean(product.sizeChartImage || product.sizeChartTable);

  const variant = product.variants.find(
    (v) => (!sizes.length || v.size === size) && (!colors.length || v.color === color),
  );
  const stock = variant?.stock ?? 0;
  const pct = discountPct(product);

  const handleAdd = async () => {
    if (!variant) return showToast('Please select options');
    setBusy(true);
    try {
      await addToCart(variant.id, qty);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not add to cart');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {/* Gallery */}
      <div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-black/5">
          {product.images[activeImg] && (
            <Image
              src={product.images[activeImg].url}
              alt={product.title}
              fill
              priority
              sizes="(max-width:1024px) 100vw, 50vw"
              className="object-cover"
            />
          )}
          {pct && <span className="badge absolute left-3 top-3 bg-sale text-white">-{pct}%</span>}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {product.images.map((im, i) => (
            <button
              key={im.id}
              onClick={() => setActiveImg(i)}
              aria-label={`View image ${i + 1}`}
              className={`relative h-20 w-16 shrink-0 overflow-hidden rounded border-2 ${
                i === activeImg ? 'border-accent' : 'border-transparent'
              }`}
            >
              <Image src={im.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div>
        {product.brand && <p className="text-sm uppercase tracking-wide text-ink/50">{product.brand}</p>}
        <h1 className="mt-1 font-serif text-3xl font-bold">{product.title}</h1>

        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="flex items-center gap-0.5 text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={15} fill={i < Math.round(product.ratingAvg) ? 'currentColor' : 'none'} />
            ))}
          </span>
          <span className="text-ink/50">({product.ratingCount} reviews)</span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-2xl font-bold">{formatPKR(effectivePrice(product))}</span>
          {product.salePrice && (
            <span className="text-lg text-ink/40 line-through">{formatPKR(product.basePrice)}</span>
          )}
        </div>

        {/* Color */}
        {colors.length > 0 && (
          <div className="mt-6">
            <p className="label">Color: <span className="font-normal">{color}</span></p>
            <div className="flex gap-2">
              {colors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.name)}
                  title={c.name}
                  aria-label={`Colour: ${c.name}`}
                  aria-pressed={color === c.name}
                  className={`h-8 w-8 rounded-full border-2 ${color === c.name ? 'border-accent' : 'border-black/10'}`}
                  style={{ backgroundColor: c.hex ?? '#ccc' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Size */}
        {sizes.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <p className="label">Size</p>
              {hasSizeChart && (
                <button
                  type="button"
                  onClick={() => setShowSizeChart(true)}
                  className="mb-1 text-sm font-medium text-accent underline underline-offset-2"
                >
                  Size chart
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`min-w-11 rounded-md border px-3 py-2 text-sm ${
                    size === s ? 'border-accent bg-accent/5 font-semibold' : 'border-ink/20'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stock indicator */}
        <p className="mt-4 text-sm">
          {stock === 0 ? (
            <span className="font-medium text-sale">Out of stock</span>
          ) : stock <= 5 ? (
            <span className="font-medium text-accent">Only {stock} left</span>
          ) : (
            <span className="text-green-700">In stock</span>
          )}
        </p>

        {/* Qty + actions */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex items-center rounded-md border border-ink/20">
            <button className="p-2.5" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">
              <Minus size={16} />
            </button>
            <span className="w-8 text-center text-sm font-medium">{qty}</span>
            <button
              className="p-2.5"
              onClick={() => setQty((q) => Math.min(stock || 1, q + 1))}
              aria-label="Increase"
            >
              <Plus size={16} />
            </button>
          </div>
          <button onClick={handleAdd} disabled={busy || stock === 0} className="btn-primary flex-1">
            {stock === 0 ? 'Sold Out' : busy ? 'Adding…' : 'Add to Cart'}
          </button>
          <button
            onClick={() => toggleWishlist(product.id)}
            className="btn-outline"
            aria-label={wl ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={wl}
          >
            <Heart size={18} className={wl ? 'fill-sale text-sale' : ''} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-md bg-black/5 p-3 text-sm text-ink/70">
          <Truck size={18} className="text-accent" /> Free delivery on orders above Rs. 3,000 · COD available
        </div>

        {/* Tabs */}
        <div className="mt-8 border-t border-black/10 pt-6">
          <div className="flex flex-wrap gap-4 border-b border-black/10">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 pb-2 text-sm font-medium ${
                  tab === t ? 'border-accent text-accent' : 'border-transparent text-ink/60'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="prose prose-sm mt-4 max-w-none text-ink/80">
            {tab === 'Description' && (
              <div dangerouslySetInnerHTML={{ __html: product.description }} />
            )}
            {tab === 'Size & Fit' && (
              <div>
                <p>Model is 5&apos;7&quot; wearing size M. Regular fit.</p>
                {hasSizeChart && (
                  <button
                    type="button"
                    onClick={() => setShowSizeChart(true)}
                    className="mt-2 font-medium text-accent underline underline-offset-2"
                  >
                    View size chart
                  </button>
                )}
              </div>
            )}
            {tab === 'Fabric & Care' && <p>Fabric: {product.fabric ?? 'Premium fabric'}. Machine wash cold, do not bleach, warm iron.</p>}
            {tab === 'Shipping & Returns' && <p>Delivered nationwide in 3-5 working days. Easy 7-day returns on unused items with tags.</p>}
          </div>
        </div>
      </div>

      {showSizeChart && (
        <SizeChartModal
          chart={{ image: product.sizeChartImage, table: product.sizeChartTable }}
          onClose={() => setShowSizeChart(false)}
        />
      )}
    </div>
  );
}
