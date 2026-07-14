'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PROVINCES } from '@store/shared-types';
import { useStore } from '@/providers/StoreProvider';
import { clientApi, ApiError } from '@/lib/client-api';
import { formatPKR } from '@/lib/format';
import { Select } from '@/components/ui/Select';

const PK_CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala', 'Hyderabad', 'Other'];

const PAYMENTS = [
  { id: 'COD', label: 'Cash on Delivery', desc: 'Pay when you receive your order', enabled: true },
  { id: 'JAZZCASH', label: 'JazzCash', desc: 'Mobile account / card (coming soon)', enabled: false },
  { id: 'EASYPAISA', label: 'EasyPaisa', desc: 'Mobile account / card (coming soon)', enabled: false },
  { id: 'STRIPE', label: 'Card (Stripe)', desc: 'International cards (coming soon)', enabled: false },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, user, loading } = useStore();
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    addressLine: '',
    city: 'Karachi',
    province: PROVINCES[0] as string,
    postalCode: '',
  });
  const [payment, setPayment] = useState('COD');
  const [delivery, setDelivery] = useState<'standard' | 'express'>('standard');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/checkout');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, fullName: f.fullName || user.name, phone: f.phone || user.phone || '' }));
  }, [user]);

  if (loading || !user) return <div className="container-x py-20 text-center">Loading…</div>;
  if (!cart || cart.lines.length === 0)
    return <div className="container-x py-20 text-center">Your cart is empty.</div>;

  const placeOrder = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await clientApi.post<{ order: { id: string } }>('/orders/checkout', {
        paymentMethod: payment,
        deliveryMethod: delivery,
        notes: notes || undefined,
        newAddress: { label: 'Home', ...form },
      });
      router.push(`/order-confirmation/${res.order.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not place order');
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="container-x py-8">
      <h1 className="mb-6 font-serif text-3xl font-bold">Checkout</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Shipping */}
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-semibold">Shipping Address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name"><input className="input" value={form.fullName} onChange={set('fullName')} /></Field>
              <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} placeholder="03XXXXXXXXX" /></Field>
              <div className="sm:col-span-2">
                <Field label="Address"><input className="input" value={form.addressLine} onChange={set('addressLine')} placeholder="House #, Street, Area" /></Field>
              </div>
              <Field label="City">
                <Select
                  className="w-full"
                  value={form.city}
                  onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                  options={PK_CITIES.map((c) => ({ value: c, label: c }))}
                />
              </Field>
              <Field label="Province">
                <Select
                  className="w-full"
                  value={form.province}
                  onChange={(v) => setForm((f) => ({ ...f, province: v }))}
                  options={PROVINCES.map((p) => ({ value: p, label: p }))}
                />
              </Field>
              <Field label="Postal Code (optional)"><input className="input" value={form.postalCode} onChange={set('postalCode')} /></Field>
            </div>
          </section>

          {/* Delivery */}
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-semibold">Delivery Method</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['standard', 'express'] as const).map((d) => (
                <label key={d} className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 ${delivery === d ? 'border-accent bg-accent/5' : 'border-ink/15'}`}>
                  <input type="radio" checked={delivery === d} onChange={() => setDelivery(d)} />
                  <div>
                    <p className="font-medium capitalize">{d}</p>
                    <p className="text-xs text-ink/60">{d === 'standard' ? '3-5 working days' : '1-2 working days'}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Payment */}
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-semibold">Payment Method</h2>
            <div className="space-y-3">
              {PAYMENTS.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 ${
                    payment === p.id ? 'border-accent bg-accent/5' : 'border-ink/15'
                  } ${!p.enabled ? 'opacity-50' : ''}`}
                >
                  <input type="radio" name="pay" disabled={!p.enabled} checked={payment === p.id} onChange={() => setPayment(p.id)} />
                  <div>
                    <p className="font-medium">{p.label}</p>
                    <p className="text-xs text-ink/60">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Order notes (optional)"
              className="input mt-4 h-20 resize-none"
            />
          </section>
        </div>

        {/* Summary */}
        <div className="card h-fit p-5">
          <h2 className="mb-4 font-serif text-xl font-bold">Your Order</h2>
          <div className="mb-4 space-y-2 text-sm">
            {cart.lines.map((l) => (
              <div key={l.variantId} className="flex justify-between">
                <span className="text-ink/70">{l.productTitle} × {l.quantity}</span>
                <span>{formatPKR(l.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-black/10 pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatPKR(cart.subtotal)}</span></div>
            {cart.discount > 0 && <div className="flex justify-between text-accent"><span>Discount</span><span>- {formatPKR(cart.discount)}</span></div>}
            <div className="flex justify-between"><span>Shipping</span><span>{cart.shipping === 0 ? 'Free' : formatPKR(cart.shipping)}</span></div>
            <div className="flex justify-between border-t border-black/10 pt-2 text-base font-bold"><span>Total</span><span>{formatPKR(cart.total)}</span></div>
          </div>

          {error && <p className="mt-4 rounded bg-sale/10 p-2 text-sm text-sale">{error}</p>}

          <button onClick={placeOrder} disabled={busy} className="btn-primary mt-5 w-full">
            {busy ? 'Placing Order…' : 'Place Order'}
          </button>
          <p className="mt-3 text-center text-xs text-ink/50">🔒 Secure checkout</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
