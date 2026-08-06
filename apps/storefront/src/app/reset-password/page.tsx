'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { clientApi } from '@/lib/client-api';
import { fieldErrors, readableError } from '@/lib/api-errors';
import { PasswordInput } from '@/components/ui/PasswordInput';

function ResetInner() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Someone opening /reset-password directly has nothing to act on. Say so
  // rather than showing a form that can only fail.
  if (!token) {
    return (
      <div className="card mt-6 p-6">
        <p className="font-medium">This link isn&apos;t valid</p>
        <p className="mt-1 text-sm text-ink/60">
          Password reset links expire after 1 hour and can only be used once.
        </p>
        <Link href="/forgot-password" className="btn-primary mt-4 inline-block">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card mt-6 flex items-start gap-3 p-6">
        <CheckCircle2 className="mt-0.5 shrink-0 text-green-600" size={20} />
        <div>
          <p className="font-medium">Password updated</p>
          <p className="mt-1 text-sm text-ink/60">
            You&apos;ve been signed out everywhere else for security. Log in with your new
            password.
          </p>
          <Link href="/login" className="btn-primary mt-4 inline-block">
            Log in
          </Link>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Checked here so a typo is caught before a round trip; the API doesn't
    // receive the confirmation field at all.
    if (password !== confirm) {
      setError('Both passwords must match.');
      return;
    }
    setBusy(true);
    try {
      await clientApi.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => router.push('/login'), 4000);
    } catch (err) {
      const perField = fieldErrors(err);
      setError(
        perField.token ??
          readableError(err, { password: 'Password' }, 'Could not reset your password.'),
      );
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
      <div>
        <label className="label">New password</label>
        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <p className="mt-1 text-xs text-ink/55">At least 8 characters.</p>
      </div>
      <div>
        <label className="label">Confirm new password</label>
        <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      {error && (
        <div className="rounded bg-sale/10 p-3 text-sm text-sale" role="alert">
          <p>{error}</p>
          {/* An expired or already-used token can only be resolved by starting over. */}
          {/expired|not valid|invalid/i.test(error) && (
            <Link href="/forgot-password" className="mt-1 inline-block font-medium underline">
              Request a new link
            </Link>
          )}
        </div>
      )}
      <button disabled={busy} className="btn-primary w-full">
        {busy ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="container-x max-w-md py-16">
      <h1 className="font-serif text-3xl font-bold">Set a new password</h1>
      {/* useSearchParams() needs a Suspense boundary in the App Router. */}
      <Suspense fallback={<p className="mt-6 text-ink/60">Loading…</p>}>
        <ResetInner />
      </Suspense>
    </div>
  );
}
