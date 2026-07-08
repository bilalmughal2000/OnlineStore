import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@store.pk');
  const [password, setPassword] = useState('admin12345');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-stone-100 px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <h1 className="font-serif text-2xl font-bold">Store Admin</h1>
        <p className="mt-1 text-sm text-stone-500">Sign in to manage your store.</p>
        <div className="mt-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="btn-primary w-full">
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-stone-400">Demo: admin@store.pk / admin12345</p>
      </form>
    </div>
  );
}
