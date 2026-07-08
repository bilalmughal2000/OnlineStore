'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { clientApi } from '@/lib/client-api';
import { formatPKR } from '@/lib/format';
import { useStore } from '@/providers/StoreProvider';

export default function OrderConfirmation({ params }: { params: { id: string } }) {
  const { refreshCart } = useStore();
  const [order, setOrder] = useState<any>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    clientApi
      .get<{ order: any }>(`/orders/${params.id}`)
      .then((d) => setOrder(d.order))
      .catch(() => setErr(true));
    refreshCart();
  }, [params.id, refreshCart]);

  if (err) return <div className="container-x py-20 text-center">Order not found.</div>;
  if (!order) return <div className="container-x py-20 text-center">Loading…</div>;

  return (
    <div className="container-x max-w-2xl py-12">
      <div className="card p-8 text-center">
        <CheckCircle2 className="mx-auto text-green-600" size={56} />
        <h1 className="mt-4 font-serif text-3xl font-bold">Thank you for your order!</h1>
        <p className="mt-2 text-ink/60">
          Order <strong>{order.orderNumber}</strong> has been placed. A confirmation will be sent to you.
        </p>

        <div className="mt-6 space-y-2 rounded-md bg-black/5 p-4 text-left text-sm">
          {order.items.map((it: any) => (
            <div key={it.id} className="flex justify-between">
              <span>{it.productTitle} {it.variantLabel && `(${it.variantLabel})`} × {it.quantity}</span>
              <span>{formatPKR(it.price * it.quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-black/10 pt-2 font-bold">
            <span>Total ({order.paymentMethod})</span>
            <span>{formatPKR(order.total)}</span>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <Link href="/account/orders" className="btn-outline">View My Orders</Link>
          <Link href="/" className="btn-primary">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
