'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PROVINCES } from '@store/shared-types';
import { useStore } from '@/providers/StoreProvider';
import { clientApi, ApiError } from '@/lib/client-api';
import { formatPKR } from '@/lib/format';
import { checkoutAttribution, trackBeginCheckout } from '@/lib/analytics';
import { fieldErrors, readableError } from '@/lib/api-errors';
import { Select } from '@/components/ui/Select';
import { PhoneField, isValidPKMobile, normalisePKPhone, toE164PK } from '@/components/ui/PhoneField';

// Maps the API's field paths to the labels actually printed on this form, so an
// error reads "Phone: …" rather than "newAddress.phone: …".
const FIELD_LABELS: Record<string, string> = {
  guestEmail: 'Email',
  'newAddress.fullName': 'Full Name',
  'newAddress.phone': 'Phone',
  'newAddress.addressLine': 'Address',
  'newAddress.city': 'City',
  'newAddress.province': 'Province',
  'newAddress.postalCode': 'Postal Code',
  paymentMethod: 'Payment Method',
};

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
  // Guest checkout: no account needed, but we must be able to reach the buyer,
  // so an email is required when there's no logged-in user.
  const [guestEmail, setGuestEmail] = useState('');
  const [payment, setPayment] = useState('COD');
  const [delivery, setDelivery] = useState<'standard' | 'express'>('standard');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrs, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user)
      setForm((f) => ({
        ...f,
        fullName: f.fullName || user.name,
        // A saved number may be in any format (03…, +92…) — normalise to the
        // national digits the field works in.
        phone: f.phone || normalisePKPhone(user.phone ?? ''),
      }));
  }, [user]);

  // InitiateCheckout / begin_checkout — once per visit to this page. Guarded by a
  // ref because `cart` re-renders on every coupon/qty change, and each re-fire
  // would inflate Meta's funnel and skew cost-per-checkout.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || !cart || cart.lines.length === 0) return;
    checkoutTracked.current = true;
    trackBeginCheckout(
      cart.lines.map((l) => ({
        id: l.productId,
        name: l.productTitle,
        price: l.unitPrice,
        quantity: l.quantity,
        variant: l.variantLabel,
      })),
      cart.total,
      cart.couponCode,
    );
  }, [cart]);

  // NOTE: hooks must stay above these early returns.
  // No login gate: guests check out too.
  if (loading) return <div className="container-x py-20 text-center">Loading…</div>;
  if (!cart || cart.lines.length === 0)
    return <div className="container-x py-20 text-center">Your cart is empty.</div>;

  const placeOrder = async () => {
    setError(null);
    setFieldErrors({});
    // Validate here so the buyer gets an inline message instead of a 400 after
    // the round trip. The API enforces the same rule regardless.
    if (!user && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail.trim())) {
      setFieldErrors({ guestEmail: 'Enter a valid email address.' });
      setError('Please enter a valid email address so we can send your order confirmation.');
      return;
    }
    if (!isValidPKMobile(form.phone)) {
      const detail =
        form.phone.length === 0
          ? 'Enter your mobile number — the courier needs it to deliver.'
          : `Enter all ${10} digits of your mobile number (you have ${form.phone.length}).`;
      setFieldErrors({ 'newAddress.phone': detail });
      setError(`Phone: ${detail}`);
      document
        .querySelector('[data-field="newAddress.phone"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(true);
    try {
      const res = await clientApi.post<{ order: { id: string }; guestToken?: string }>(
        '/orders/checkout',
        {
          paymentMethod: payment,
          deliveryMethod: delivery,
          notes: notes || undefined,
          // Phone is held as national digits in the form; the API wants E.164.
          newAddress: { label: 'Home', ...form, phone: toE164PK(form.phone) },
          ...(user ? {} : { guestEmail: guestEmail.trim() }),
          // Lets the API attribute this sale to the ad click server-side.
          attribution: checkoutAttribution(),
        },
      );
      // A guest has no session, so the order is reopened with the token issued
      // at checkout. It also goes in the confirmation email.
      router.push(
        res.guestToken
          ? `/order-confirmation/${res.order.id}?token=${res.guestToken}`
          : `/order-confirmation/${res.order.id}`,
      );
    } catch (e) {
      // Surface WHICH field failed. The API sends per-field issues; showing only
      // the generic "Validation failed" leaves the buyer hunting through the
      // whole form, which is how a ready-to-pay order gets abandoned.
      const perField = fieldErrors(e);
      setFieldErrors(perField);
      setError(readableError(e, FIELD_LABELS, 'Could not place order. Please try again.'));
      // Scroll the first bad field into view — on mobile it's often off-screen.
      const firstBad = Object.keys(perField)[0];
      if (firstBad) {
        document
          .querySelector(`[data-field="${firstBad}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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
          {/* Contact — guests only. Signing in is offered, never required:
              forcing an account here is a well-known way to lose the sale. */}
          {!user && (
            <section className="card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Contact</h2>
                <p className="text-sm text-ink/60">
                  Have an account?{' '}
                  <Link href="/login?redirect=/checkout" className="font-medium text-accent hover:underline">
                    Log in
                  </Link>
                </p>
              </div>
              <div data-field="guestEmail">
                <Field label="Email">
                  <input
                    className={`input ${fieldErrs.guestEmail ? 'border-sale' : ''}`}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="you@example.com"
                    aria-invalid={Boolean(fieldErrs.guestEmail)}
                  />
                </Field>
                {fieldErrs.guestEmail && (
                  <p className="mt-1 text-xs text-sale">{fieldErrs.guestEmail}</p>
                )}
              </div>
              <p className="mt-2 text-xs text-ink/55">
                We&apos;ll email your order confirmation and tracking link here. No account needed.
              </p>
            </section>
          )}

          {/* Shipping */}
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-semibold">Shipping Address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div data-field="newAddress.fullName">
                <Field label="Full Name">
                  <input
                    className={`input ${fieldErrs['newAddress.fullName'] ? 'border-sale' : ''}`}
                    value={form.fullName}
                    onChange={set('fullName')}
                    autoComplete="name"
                  />
                </Field>
                {fieldErrs['newAddress.fullName'] && (
                  <p className="mt-1 text-xs text-sale">{fieldErrs['newAddress.fullName']}</p>
                )}
              </div>
              <PhoneField
                value={form.phone}
                onChange={(national) => setForm((f) => ({ ...f, phone: national }))}
                error={fieldErrs['newAddress.phone']}
              />
              <div className="sm:col-span-2" data-field="newAddress.addressLine">
                <Field label="Address">
                  <input
                    className={`input ${fieldErrs['newAddress.addressLine'] ? 'border-sale' : ''}`}
                    value={form.addressLine}
                    onChange={set('addressLine')}
                    placeholder="House #, Street, Area"
                    autoComplete="street-address"
                  />
                </Field>
                {fieldErrs['newAddress.addressLine'] && (
                  <p className="mt-1 text-xs text-sale">{fieldErrs['newAddress.addressLine']}</p>
                )}
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

          {error && (
            <div className="mt-4 rounded bg-sale/10 p-3 text-sm text-sale" role="alert">
              {/* List each bad field by name. A bare "Validation failed" next to
                  a full form tells the buyer nothing about what to change. */}
              {Object.keys(fieldErrs).length > 0 ? (
                <>
                  <p className="font-medium">Please check these fields:</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {Object.entries(fieldErrs).map(([path, msg]) => (
                      <li key={path}>
                        <span className="font-medium">{FIELD_LABELS[path] ?? path}</span> — {msg}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                error
              )}
            </div>
          )}

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
