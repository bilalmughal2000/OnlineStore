'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/providers/StoreProvider';
import { formatPKR } from '@/lib/format';
import { clientApi, ApiError } from '@/lib/client-api';
import type { Cart } from '@/lib/types';

export default function CartPage() {
  const { cart, updateQty, removeItem, refreshCart } = useStore();
  const [coupon, setCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [applied, setApplied] = useState<Cart | null>(null);

  const view = applied ?? cart;

  const applyCoupon = async () => {
    setCouponMsg(null);
    try {
      const c = await clientApi.get<Cart>(`/cart?coupon=${encodeURIComponent(coupon)}`);
      setApplied(c);
      setCouponMsg(c.couponCode ? `Coupon ${c.couponCode} applied` : 'Coupon applied');
    } catch (e) {
      setApplied(null);
      setCouponMsg(e instanceof ApiError ? e.message : 'Invalid coupon');
    }
  };

  if (!view || view.lines.length === 0) {
    return (
      <div className="container-x py-20 text-center">
        <h1 className="font-serif text-3xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-ink/60">Discover our latest collection.</p>
        <Link href="/" className="btn-primary mt-6">
          Continue Shopping
        </Link>
      </div>
    );
  }

  const pct = view.freeShippingThreshold
    ? Math.min(100, ((view.freeShippingThreshold - view.amountToFreeShipping) / view.freeShippingThreshold) * 100)
    : 100;

  return (
    <div className="container-x py-8">
      <h1 className="mb-6 font-serif text-3xl font-bold">Shopping Cart</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {view.amountToFreeShipping > 0 ? (
            <div className="mb-4 rounded-md bg-accent/10 p-3 text-sm">
              Add <strong>{formatPKR(view.amountToFreeShipping)}</strong> more for free delivery!
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
                <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
              🎉 You&apos;ve unlocked free delivery!
            </div>
          )}

          <div className="divide-y divide-black/5 card">
            {view.lines.map((line) => (
              <div key={line.variantId} className="flex gap-4 p-4">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded bg-black/5">
                  {line.image && <Image src={line.image} alt={line.productTitle} fill sizes="80px" className="object-cover" />}
                </div>
                <div className="flex flex-1 flex-col">
                  <Link href={`/product/${line.slug}`} className="font-medium hover:text-accent">
                    {line.productTitle}
                  </Link>
                  {line.variantLabel && <p className="text-sm text-ink/50">{line.variantLabel}</p>}
                  <p className="mt-1 text-sm font-semibold">{formatPKR(line.unitPrice)}</p>
                  <div className="mt-auto flex items-center gap-3 pt-2">
                    <div className="flex items-center rounded-md border border-ink/20">
                      <button
                        className="p-2"
                        onClick={async () => {
                          await updateQty(line.variantId, Math.max(0, line.quantity - 1));
                          setApplied(null);
                        }}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm">{line.quantity}</span>
                      <button
                        className="p-2"
                        disabled={line.quantity >= line.stock}
                        onClick={async () => {
                          await updateQty(line.variantId, line.quantity + 1);
                          setApplied(null);
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      className="text-ink/50 hover:text-sale"
                      onClick={async () => {
                        await removeItem(line.variantId);
                        setApplied(null);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="text-right font-semibold">{formatPKR(line.lineTotal)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="card h-fit p-5">
          <h2 className="mb-4 font-serif text-xl font-bold">Order Summary</h2>
          <div className="mb-3 flex gap-2">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="Coupon code"
              className="input"
            />
            <button onClick={applyCoupon} className="btn-outline whitespace-nowrap">
              Apply
            </button>
          </div>
          {couponMsg && <p className="mb-3 text-sm text-accent">{couponMsg}</p>}

          <dl className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatPKR(view.subtotal)} />
            {view.discount > 0 && <Row label="Discount" value={`- ${formatPKR(view.discount)}`} accent />}
            <Row label="Shipping" value={view.shipping === 0 ? 'Free' : formatPKR(view.shipping)} />
            {view.tax > 0 && <Row label="Tax" value={formatPKR(view.tax)} />}
            <div className="my-2 border-t border-black/10" />
            <Row label="Total" value={formatPKR(view.total)} bold />
          </dl>

          <Link href={`/checkout${view.couponCode ? `?coupon=${view.couponCode}` : ''}`} className="btn-primary mt-5 w-full">
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-bold' : ''} ${accent ? 'text-accent' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
