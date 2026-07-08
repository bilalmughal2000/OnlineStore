import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPKR, formatDate } from '@/lib/format';
import { Select } from '@/components/Select';

const STATUSES = ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED'];
const PAY_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];

export function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [note, setNote] = useState('');

  const load = () => api.get<{ order: any }>(`/admin/orders/${id}`).then((d) => setOrder(d.order));
  useEffect(() => { load(); }, [id]);

  if (!order) return <p className="text-stone-500">Loading…</p>;

  const updateStatus = async (status: string) => {
    await api.patch(`/admin/orders/${id}/status`, { status, note: note || undefined });
    setNote('');
    load();
  };
  const updatePayment = async (paymentStatus: string) => {
    await api.patch(`/admin/orders/${id}/payment`, { paymentStatus });
    load();
  };

  return (
    <div className="max-w-4xl">
      <button onClick={() => navigate('/orders')} className="mb-4 flex items-center gap-1 text-sm text-stone-500">
        <ArrowLeft size={16} /> Back to orders
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-sm text-stone-500">{formatDate(order.createdAt)}</p>
        </div>
        <button onClick={() => window.print()} className="btn-outline"><Printer size={16} /> Print invoice</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Items</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-stone-100">
                {order.items.map((it: any) => (
                  <tr key={it.id}>
                    <td className="py-2">{it.productTitle} {it.variantLabel && <span className="text-stone-500">({it.variantLabel})</span>}</td>
                    <td className="py-2 text-center">× {it.quantity}</td>
                    <td className="py-2 text-right">{formatPKR(it.price * it.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-sm">
              <Row l="Subtotal" v={formatPKR(order.subtotal)} />
              {order.discount > 0 && <Row l={`Discount ${order.couponCode ? `(${order.couponCode})` : ''}`} v={`- ${formatPKR(order.discount)}`} />}
              <Row l="Shipping" v={order.shipping === 0 ? 'Free' : formatPKR(order.shipping)} />
              <Row l="Total" v={formatPKR(order.total)} bold />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Status timeline</h2>
            <ol className="space-y-2">
              {order.statusLogs.map((l: any) => (
                <li key={l.id} className="flex items-center gap-3 text-sm">
                  <span className="h-2 w-2 rounded-full bg-brand" />
                  <span className="font-medium">{l.status.replace(/_/g, ' ')}</span>
                  {l.note && <span className="text-stone-500">— {l.note}</span>}
                  <span className="ml-auto text-xs text-stone-400">{formatDate(l.createdAt)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Customer</h2>
            <p className="text-sm font-medium">{order.user?.name}</p>
            <p className="text-sm text-stone-500">{order.user?.email}</p>
            <p className="text-sm text-stone-500">{order.user?.phone}</p>
            {order.address && (
              <div className="mt-3 rounded bg-stone-50 p-3 text-sm text-stone-600">
                {order.address.fullName}<br />
                {order.address.addressLine}<br />
                {order.address.city}, {order.address.province}<br />
                {order.address.phone}
              </div>
            )}
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="font-semibold">Update Status</h2>
            <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Select
              value={order.status}
              onChange={updateStatus}
              options={STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
            />

            <h2 className="pt-2 font-semibold">Payment: {order.paymentMethod}</h2>
            <Select
              value={order.paymentStatus}
              onChange={updatePayment}
              options={PAY_STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-bold' : ''}`}>
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );
}
