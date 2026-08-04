'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { ApiError } from '@/lib/client-api';
import { useStore } from '@/providers/StoreProvider';

/**
 * Post-purchase account offer, shown on the confirmation page of a guest order.
 *
 * Deliberately placed *after* the sale: the buyer has already handed over email,
 * name, phone and address, so all that's left is a password. Asking before
 * checkout is what a signup wall is, and that's what loses orders.
 *
 * Purely optional — dismissing it changes nothing about the order.
 */
export function ClaimOrderCard({
  orderId,
  token,
  email,
}: {
  orderId: string;
  token: string;
  email: string;
}) {
  const { claimGuestOrder, user } = useStore();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null until submitted, then records which action actually ran. Needed because
  // a successful claim signs the user in, so `user` alone can no longer tell us
  // whether they created an account or attached to an existing one.
  const [done, setDone] = useState<null | 'created' | 'attached'>(null);
  const [dismissed, setDismissed] = useState(false);

  // Someone arriving from a "find my order" email while already signed in can
  // move that order onto their account — no second account, no password.
  const attaching = Boolean(user) && !done;

  if (dismissed) return null;

  // Rendered after success too. The parent keeps this mounted deliberately:
  // claiming signs the user in, and if the card vanished on that state change
  // the buyer would get no confirmation that anything happened.
  if (done) {
    return (
      <div className="card mt-6 flex items-start gap-3 p-6 text-left">
        <CheckCircle2 className="mt-0.5 shrink-0 text-green-600" size={20} />
        <div>
          <p className="font-medium">
            {done === 'attached' ? 'Saved to your account' : 'Account created'}
          </p>
          <p className="mt-1 text-sm text-ink/60">
            You&apos;re signed in as {user?.email ?? email}. This order is saved to your account.
          </p>
          <Link href="/account/orders" className="btn-outline mt-3 inline-block">
            View My Orders
          </Link>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Validated here rather than with the input's minLength so the message is
    // styled like the rest of the form instead of a native browser tooltip.
    if (!attaching && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      // When attaching, the API ignores the password and links the order to the
      // current session — but it still validates the field, so send a filler
      // that satisfies the schema.
      await claimGuestOrder(orderId, token, attaching ? 'attach-only-unused' : password);
      setDone(attaching ? 'attached' : 'created');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : attaching
            ? 'Could not add this order to your account'
            : 'Could not create your account',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card mt-6 p-6 text-left">
      <div className="flex items-start gap-3">
        <UserPlus className="mt-0.5 shrink-0 text-accent" size={20} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {attaching ? 'Add this order to your account' : 'Save your details for next time'}
          </p>
          <p className="mt-1 text-sm text-ink/60">
            {attaching ? (
              <>
                You placed this as a guest. Save it to{' '}
                <strong className="break-all">{user!.email}</strong> so it appears in your order
                history.
              </>
            ) : (
              <>
                Create a password for <strong className="break-all">{email}</strong> to track this
                order and check out faster. Optional — your order is already confirmed.
              </>
            )}
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {!attaching && (
              <input
                type="password"
                className="input flex-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                autoComplete="new-password"
                aria-label="Choose a password"
              />
            )}
            <button type="submit" disabled={busy} className="btn-primary whitespace-nowrap">
              {busy ? 'Saving…' : attaching ? 'Save to my account' : 'Create account'}
            </button>
          </div>

          {error && <p className="mt-2 text-sm text-sale">{error}</p>}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="mt-3 text-sm text-ink/50 underline hover:text-ink/70"
          >
            No thanks
          </button>
        </div>
      </div>
    </form>
  );
}
