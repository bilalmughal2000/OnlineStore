'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/providers/StoreProvider';
import { clientApi } from '@/lib/client-api';
import { formatPKR } from '@/lib/format';

const STATUS_COLORS: Record<string, string> = {
  PLACED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-indigo-100 text-indigo-700',
  PACKED: 'bg-purple-100 text-purple-700',
  SHIPPED: 'bg-amber-100 text-amber-700',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  RETURNED: 'bg-gray-200 text-gray-700',
};

export default function OrdersPage() {
  const { user, loading } = useStore();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) return router.replace('/login?redirect=/account/orders');
    if (user) clientApi.get<{ orders: any[] }>('/orders').then((d) => { setOrders(d.orders); setReady(true); });
  }, [user, loading, router]);

  if (!ready) return <div className="container-x py-20 text-center">Loading…</div>;

  return (
    <div className="container-x py-8">
      <h1 className="mb-6 font-serif text-3xl font-bold">My Orders</h1>
      {orders.length === 0 ? (
        <p className="py-16 text-center text-ink/60">You haven&apos;t placed any orders yet.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold">{o.orderNumber}</p>
                <p className="text-sm text-ink/50">
                  {new Date(o.createdAt).toLocaleDateString('en-PK')} · {o.items.length} item(s) · {o.paymentMethod}
                </p>
              </div>
              <span className={`badge ${STATUS_COLORS[o.status] ?? 'bg-gray-100'}`}>{o.status.replace(/_/g, ' ')}</span>
              <div className="text-right">
                <p className="font-bold">{formatPKR(o.total)}</p>
                <Link href={`/order-confirmation/${o.id}`} className="text-sm text-accent hover:underline">
                  View details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
