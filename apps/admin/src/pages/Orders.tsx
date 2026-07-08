import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatPKR, formatDate } from '@/lib/format';
import { Select } from '@/components/Select';

const STATUSES = ['', 'PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED'];

export function Orders() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    const q = new URLSearchParams({ pageSize: '100' });
    if (status) q.set('status', status);
    if (search) q.set('search', search);
    api.get<{ items: any[] }>(`/admin/orders?${q}`).then((d) => setItems(d.items));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-bold">Orders</h1>
      <div className="mb-4 flex gap-3">
        <input className="input max-w-xs" placeholder="Search order # or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select
          className="w-56"
          value={status}
          onChange={setStatus}
          options={STATUSES.map((s) => ({ value: s, label: s ? s.replace(/_/g, ' ') : 'All statuses' }))}
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="th">Order</th>
              <th className="th">Customer</th>
              <th className="th">Payment</th>
              <th className="th">Status</th>
              <th className="th text-right">Total</th>
              <th className="th text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((o) => (
              <tr key={o.id} className="hover:bg-stone-50">
                <td className="td"><Link to={`/orders/${o.id}`} className="font-medium text-brand">{o.orderNumber}</Link></td>
                <td className="td">{o.user?.name}<p className="text-xs text-stone-500">{o.user?.email}</p></td>
                <td className="td">{o.paymentMethod} <span className="text-xs text-stone-400">({o.paymentStatus})</span></td>
                <td className="td">{o.status.replace(/_/g, ' ')}</td>
                <td className="td text-right font-medium">{formatPKR(o.total)}</td>
                <td className="td text-right text-xs text-stone-500">{formatDate(o.createdAt)}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td className="td text-stone-500" colSpan={6}>No orders.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
