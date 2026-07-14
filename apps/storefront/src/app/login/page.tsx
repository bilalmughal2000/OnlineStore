'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/providers/StoreProvider';
import { ApiError } from '@/lib/client-api';
import { PasswordInput } from '@/components/ui/PasswordInput';

function LoginInner() {
  const { login, register } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') ?? '/account';
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register({ name: form.name, email: form.email, phone: form.phone || undefined, password: form.password });
      router.push(redirect);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
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
              <input className="input" value={form.name} onChange={set('name')} required />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={set('email')} required />
          </div>
          {mode === 'register' && (
            <div>
              <label className="label">Phone (optional)</label>
              <input className="input" value={form.phone} onChange={set('phone')} placeholder="03XXXXXXXXX" />
            </div>
          )}
          <div>
            <label className="label">Password</label>
            <PasswordInput value={form.password} onChange={set('password')} required minLength={8} />
          </div>

          {error && <p className="rounded bg-sale/10 p-2 text-sm text-sale">{error}</p>}

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
