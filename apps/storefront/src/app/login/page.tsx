'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/providers/StoreProvider';
import { ApiError } from '@/lib/client-api';
import { fieldErrors, readableError } from '@/lib/api-errors';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PhoneField, isValidPKMobile, toE164PK } from '@/components/ui/PhoneField';

// Maps the API's field paths to the labels on this form, so an error reads
// "Phone: …" rather than "phone: …".
const FIELD_LABELS: Record<string, string> = {
  name: 'Full Name',
  email: 'Email',
  phone: 'Phone',
  password: 'Password',
};

function LoginInner() {
  const { login, register } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') ?? '/account';
  const [mode, setMode] = useState<'login' | 'register'>('login');
  // `phone` holds the 10 national digits (no +92, no leading 0) — see PhoneField.
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrs, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Phone is optional on sign-up, but if they typed one it must be complete —
    // catch it here so they get an inline message instead of a 400.
    if (mode === 'register' && form.phone && !isValidPKMobile(form.phone)) {
      const msg = `Enter all 10 digits of your mobile number (you have ${form.phone.length}), or leave it blank.`;
      setFieldErrors({ phone: msg });
      setError(`Phone: ${msg}`);
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else
        await register({
          name: form.name,
          email: form.email,
          // Send E.164 when provided; omit entirely when blank (it's optional).
          phone: form.phone ? toE164PK(form.phone) : undefined,
          password: form.password,
        });
      router.push(redirect);
    } catch (err) {
      // Show WHICH field failed. The API returns per-field issues; surfacing only
      // "Validation failed" leaves people re-reading a form with no clue why.
      setFieldErrors(fieldErrors(err));
      setError(readableError(err, FIELD_LABELS, 'Something went wrong. Please try again.'));
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="container-x flex justify-center py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="font-serif text-2xl font-bold">{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
        <p className="mt-1 text-sm text-ink/60">
          {mode === 'login' ? 'Log in to continue shopping.' : 'Join us for faster checkout & order tracking.'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="label">Full Name</label>
              <input
                className={`input ${fieldErrs.name ? 'border-sale' : ''}`}
                value={form.name}
                onChange={set('name')}
                autoComplete="name"
                required
              />
              {fieldErrs.name && <p className="mt-1 text-xs text-sale">{fieldErrs.name}</p>}
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className={`input ${fieldErrs.email ? 'border-sale' : ''}`}
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
            />
            {fieldErrs.email && <p className="mt-1 text-xs text-sale">{fieldErrs.email}</p>}
          </div>
          {mode === 'register' && (
            <PhoneField
              id="signup-phone"
              optional
              value={form.phone}
              onChange={(national) => setForm((f) => ({ ...f, phone: national }))}
              error={fieldErrs.phone}
            />
          )}
          <div>
            <div className="flex items-baseline justify-between">
              <label className="label">Password</label>
              {/* Only meaningful when logging in — there is nothing to recover
                  while creating an account. */}
              {mode === 'login' && (
                <Link href="/forgot-password" className="text-xs text-accent hover:underline">
                  Forgot password?
                </Link>
              )}
            </div>
            <PasswordInput value={form.password} onChange={set('password')} required minLength={8} />
            {fieldErrs.password && <p className="mt-1 text-xs text-sale">{fieldErrs.password}</p>}
          </div>

          {error && (
            <div className="rounded bg-sale/10 p-3 text-sm text-sale" role="alert">
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

          <button disabled={busy} className="btn-primary w-full">
            {busy ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink/60">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="font-medium text-accent">
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
        {/* Guests have no account to log into, so give them a way through. */}
        <p className="mt-2 text-center text-sm text-ink/60">
          Ordered as a guest?{' '}
          <Link href="/order-lookup" className="font-medium text-accent hover:underline">
            Find my order
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-x py-20 text-center">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
