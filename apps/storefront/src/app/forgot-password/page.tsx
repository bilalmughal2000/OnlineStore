'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { clientApi } from '@/lib/client-api';
import { fieldErrors, readableError } from '@/lib/api-errors';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    setBusy(true);
    try {
      await clientApi.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setFieldError(fieldErrors(err).email ?? null);
      setError(readableError(err, { email: 'Email' }, 'Could not send the reset link.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x max-w-md py-16">
      <h1 className="font-serif text-3xl font-bold">Forgot password</h1>

      {sent ? (
        <div className="card mt-6 flex items-start gap-3 p-6">
          <MailCheck className="mt-0.5 shrink-0 text-green-600" size={20} />
          <div>
            <p className="font-medium">Check your inbox</p>
            {/* Never confirms whether the account exists — otherwise this page
                becomes a way to test which emails have signed up. */}
            <p className="mt-1 text-sm text-ink/60">
              If an account exists for <strong className="break-all">{email.trim()}</strong>,
              we&apos;ve sent a link to reset your password. It expires in 1 hour.
            </p>
            <Link href="/login" className="btn-primary mt-4 inline-block">
              Back to login
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-ink/60">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>
          <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
            <div>
              <label className="label" htmlFor="forgot-email">
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                className={`input ${fieldError ? 'border-sale' : ''}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              {fieldError && <p className="mt-1 text-xs text-sale">{fieldError}</p>}
            </div>
            {error && !fieldError && (
              <p className="rounded bg-sale/10 p-2 text-sm text-sale" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy} className="btn-primary w-full">
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-ink/60">
            Remembered it?{' '}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Log in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
