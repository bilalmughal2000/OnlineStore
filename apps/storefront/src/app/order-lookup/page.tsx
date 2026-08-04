'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { clientApi, ApiError } from '@/lib/client-api';

/**
 * "Find my orders" for guests.
 *
 * The links are emailed rather than shown here on purpose: receiving the email
 * is what proves the address belongs to you. Rendering order details for
 * whoever types an address would hand out names, phone numbers and addresses to
 * anyone guessing emails.
 */
export default function OrderLookupPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await clientApi.post('/orders/lookup', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x max-w-md py-16">
      <h1 className="font-serif text-3xl font-bold">Find my order</h1>

      {sent ? (
        <div className="card mt-6 flex items-start gap-3 p-6">
          <MailCheck className="mt-0.5 shrink-0 text-green-600" size={20} />
          <div>
            <p className="font-medium">Check your inbox</p>
            {/* Deliberately does not confirm whether any orders exist — that
                would turn this into an email-enumeration tool. */}
            <p className="mt-1 text-sm text-ink/60">
              If we have orders for <strong className="break-all">{email.trim()}</strong>, we&apos;ve
              emailed you links to track them.
            </p>
            <Link href="/" className="btn-primary mt-4 inline-block">
              Continue Shopping
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-ink/60">
            Ordered as a guest? Enter the email you used and we&apos;ll send you a link to your
            orders.
          </p>
          <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
            <div>
              <label className="label" htmlFor="lookup-email">
                Email
              </label>
              <input
                id="lookup-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {error && <p className="text-sm text-sale">{error}</p>}
            <button disabled={busy} className="btn-primary w-full">
              {busy ? 'Sending…' : 'Email me my orders'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-ink/60">
            Have an account?{' '}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Log in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
