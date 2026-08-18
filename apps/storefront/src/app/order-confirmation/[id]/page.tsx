'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { clientApi } from '@/lib/client-api';
import { formatPKR } from '@/lib/format';
import { trackPurchase } from '@/lib/analytics';
import { ClaimOrderCard } from '@/components/ClaimOrderCard';
import { TrackParcel } from '@/components/TrackParcel';
import { useStore } from '@/providers/StoreProvider';

// Purchase events must be idempotent per order: a refresh or a back-forward
// navigation would otherwise report the same sale again and inflate ROAS.
// sessionStorage survives reloads of this tab but not a new session, which is
// the right trade-off for a one-off confirmation page.
function alreadyReported(orderId: string): boolean {
  const key = `purchase_reported:${orderId}`;
  try {
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, '1');
    return false;
  } catch {
    // Private mode / storage disabled: fall back to the in-memory ref guard.
    return false;
  }
}

// A guest has no session, so the order is opened with the token issued at
// checkout (also emailed). Persisted per order so a refresh — which drops the
// query string on some flows — still works, and so the back button behaves.
function guestToken(orderId: string): string | null {
  const key = `order_token:${orderId}`;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('token');
    if (fromUrl) {
      sessionStorage.setItem(key, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(key);
  } catch {
    return new URLSearchParams(window.location.search).get('token');
  }
}

export default function OrderConfirmation({ params }: { params: { id: string } }) {
  const { refreshCart, user } = useStore();
  const [order, setOrder] = useState<any>(null);
  const [err, setErr] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const reported = useRef(false);

  useEffect(() => {
    const token = guestToken(params.id);
    setToken(token);
    clientApi
      .get<{ order: any }>(`/orders/${params.id}${token ? `?token=${encodeURIComponent(token)}` : ''}`)
      .then((d) => {
        setOrder(d.order);
        if (reported.current || alreadyReported(params.id)) return;
        reported.current = true;
        trackPurchase({
          orderId: d.order.id,
          orderNumber: d.order.orderNumber,
          // Server-authoritative total — matches what the customer was charged.
          value: Number(d.order.total),
          shipping: Number(d.order.shipping ?? 0),
          tax: Number(d.order.tax ?? 0),
          coupon: d.order.couponCode ?? null,
          paymentMethod: d.order.paymentMethod,
          items: (d.order.items ?? []).map((it: any) => ({
            id: it.variant?.productId ?? it.variantId,
            name: it.productTitle,
            price: Number(it.price),
            quantity: it.quantity,
            variant: it.variantLabel,
          })),
        });
      })
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
          Order <strong>{order.orderNumber}</strong> has been placed.{' '}
          {order.guestEmail ? (
            <>
              A confirmation has been sent to <strong>{order.guestEmail}</strong>.
            </>
          ) : (
            'A confirmation will be sent to you.'
          )}
        </p>
        {/* Guests have no account to log back into, so the emailed link is the
            only route back to this page — say so plainly. */}
        {!order.userId && (
          <p className="mt-2 text-sm text-ink/55">
            Keep that email — it has the link to check your order status.
          </p>
        )}

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
          {/* "My Orders" needs a session — pointless for a guest. */}
          {user && (
            <Link href="/account/orders" className="btn-outline">View My Orders</Link>
          )}
          <Link href="/" className="btn-primary">Continue Shopping</Link>
        </div>
      </div>

      {/* Offer the account only once the sale is done, and only when there's
          something to claim: an unclaimed guest order with its token in hand.
          Note there's no `!user` condition — claiming signs the buyer in, and
          excluding logged-in users would unmount the card at that exact moment,
          swallowing its success message. It also lets someone who is already
          signed in attach a guest order they opened from a lookup email. */}
      {/* Tracking, once the parcel has been booked with the courier. */}
      <TrackParcel
        courier={order.courier}
        trackingNumber={order.trackingNumber}
        courierStatus={order.courierStatus}
      />

      {!order.userId && token && order.guestEmail && (
        <ClaimOrderCard orderId={order.id} token={token} email={order.guestEmail} />
      )}
    </div>
  );
}
