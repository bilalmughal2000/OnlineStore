import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, Printer, RefreshCw, Truck, X } from 'lucide-react';
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
  const [courier, setCourier] = useState<{
    enabled?: boolean;
    provider?: string;
    trackingUrlTemplate?: string;
  } | null>(null);
  const [courierConfigured, setCourierConfigured] = useState(false);
  const [shipBusy, setShipBusy] = useState(false);
  const [shipError, setShipError] = useState<string | null>(null);
  const [scans, setScans] = useState<{ status: string; at?: string }[] | null>(null);

  const load = () => api.get<{ order: any }>(`/admin/orders/${id}`).then((d) => setOrder(d.order));
  useEffect(() => { load(); }, [id]);

  // Whether a courier is switched on at all decides if the panel is worth showing.
  useEffect(() => {
    api
      .get<{ courier: any; configured: boolean }>('/admin/orders/courier/config')
      .then((d) => {
        setCourier(d.courier);
        setCourierConfigured(d.configured);
      })
      .catch(() => {});
  }, []);

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

  /** Book / re-sync / cancel the parcel. Courier errors are shown, not swallowed. */
  const shipmentAction = async (action: 'book' | 'sync' | 'cancel') => {
    setShipBusy(true);
    setShipError(null);
    try {
      if (action === 'book') await api.post(`/admin/orders/${id}/shipment`, {});
      else if (action === 'sync') {
        const d = await api.post<{ history: { status: string; at?: string }[] }>(
          `/admin/orders/${id}/shipment/sync`,
          {},
        );
        setScans(d.history ?? []);
      } else {
        if (!confirm('Cancel this booking with PostEx?')) return;
        await api.del(`/admin/orders/${id}/shipment`);
        setScans(null);
      }
      load();
    } catch (err) {
      setShipError(err instanceof Error ? err.message : 'Courier request failed');
    } finally {
      setShipBusy(false);
    }
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
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              Customer
              {/* No user row means this was a guest checkout — worth flagging,
                  since there's no account history to look up. */}
              {!order.user && (
                <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-600">
                  Guest
                </span>
              )}
            </h2>
            <p className="text-sm font-medium">{order.user?.name ?? order.address?.fullName ?? '—'}</p>
            <p className="text-sm text-stone-500">{order.user?.email ?? order.guestEmail ?? '—'}</p>
            <p className="text-sm text-stone-500">{order.user?.phone ?? order.address?.phone ?? ''}</p>
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

          {/* Courier. Hidden entirely until a courier is switched on in Settings,
              so stores that hand parcels over by themselves see nothing. */}
          {courier?.enabled && (
            <div className="card space-y-3 p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <Truck size={16} className="text-brand" /> Courier
              </h2>

              {!courierConfigured && (
                <p className="rounded bg-amber-50 p-2 text-xs text-amber-700">
                  No PostEx API token on the server — set <code>POSTEX_API_TOKEN</code> to book parcels.
                </p>
              )}
              {shipError && <p className="rounded bg-red-50 p-2 text-xs text-red-600">{shipError}</p>}

              {order.trackingNumber ? (
                <>
                  <div>
                    <p className="label">Tracking number</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-stone-100 px-2 py-1 text-sm">{order.trackingNumber}</code>
                      <button
                        onClick={() => navigator.clipboard?.writeText(order.trackingNumber)}
                        title="Copy"
                        className="text-stone-400 hover:text-brand"
                      >
                        <Copy size={14} />
                      </button>
                      <a
                        href={(courier.trackingUrlTemplate ?? 'https://postex.pk/tracking').replace(
                          '{cn}',
                          encodeURIComponent(order.trackingNumber),
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open tracking page"
                        className="text-stone-400 hover:text-brand"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                  <p className="text-xs text-stone-500">
                    {order.courierStatus ?? 'Booked'}
                    {order.courierSyncedAt ? ` · synced ${formatDate(order.courierSyncedAt)}` : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={shipBusy} onClick={() => shipmentAction('sync')} className="btn-outline text-xs">
                      <RefreshCw size={14} /> {shipBusy ? '…' : 'Sync status'}
                    </button>
                    <button
                      disabled={shipBusy}
                      onClick={() => shipmentAction('cancel')}
                      className="btn-outline text-xs text-red-600"
                    >
                      <X size={14} /> Cancel booking
                    </button>
                  </div>
                  {scans && scans.length > 0 && (
                    <ul className="space-y-1 border-t border-stone-100 pt-2 text-xs text-stone-500">
                      {scans.map((h, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>{h.status}</span>
                          {h.at && <span className="shrink-0">{h.at}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-stone-500">
                    Books this parcel with PostEx and sends the customer their tracking number.
                  </p>
                  <button
                    disabled={shipBusy || !courierConfigured}
                    onClick={() => shipmentAction('book')}
                    className="btn-primary w-full text-sm"
                  >
                    <Truck size={15} /> {shipBusy ? 'Booking…' : 'Book with PostEx'}
                  </button>
                </>
              )}
            </div>
          )}
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
