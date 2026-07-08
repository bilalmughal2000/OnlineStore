'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/providers/StoreProvider';
import { clientApi, ApiError } from '@/lib/client-api';

export default function ProfilePage() {
  const { user, loading } = useStore();
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) setProfile({ name: user.name, phone: user.phone ?? '' });
  }, [user]);

  if (loading) return <div className="container-x py-20 text-center">Loading…</div>;
  if (!user) return <div className="container-x py-20 text-center">Please <Link href="/login" className="text-accent">log in</Link>.</div>;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    await clientApi.patch('/auth/me', profile);
    setMsg('Profile updated');
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await clientApi.post('/auth/change-password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      setMsg('Password changed');
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Error');
    }
  };

  return (
    <div className="container-x max-w-xl py-8">
      <h1 className="mb-6 font-serif text-3xl font-bold">Profile</h1>
      {msg && <p className="mb-4 rounded bg-accent/10 p-2 text-sm text-accent">{msg}</p>}

      <form onSubmit={saveProfile} className="card mb-6 space-y-4 p-5">
        <h2 className="font-semibold">Personal details</h2>
        <div><label className="label">Name</label><input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
        <div><label className="label">Email</label><input className="input bg-black/5" value={user.email} disabled /></div>
        <div><label className="label">Phone</label><input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
        <button className="btn-primary">Save</button>
      </form>

      <form onSubmit={changePw} className="card space-y-4 p-5">
        <h2 className="font-semibold">Change password</h2>
        <div><label className="label">Current password</label><input type="password" className="input" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></div>
        <div><label className="label">New password</label><input type="password" className="input" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} minLength={8} required /></div>
        <button className="btn-outline">Update password</button>
      </form>
    </div>
  );
}
