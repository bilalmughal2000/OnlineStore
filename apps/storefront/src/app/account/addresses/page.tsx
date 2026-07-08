'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { PROVINCES } from '@store/shared-types';
import { useStore } from '@/providers/StoreProvider';
import { clientApi } from '@/lib/client-api';
import { Select } from '@/components/ui/Select';

const empty = { label: 'Home', fullName: '', phone: '', addressLine: '', city: '', province: PROVINCES[0] as string, postalCode: '' };

export default function AddressesPage() {
  const { user, loading } = useStore();
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);

  const load = () => clientApi.get<{ addresses: any[] }>('/account/addresses').then((d) => setList(d.addresses));

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (loading) return <div className="container-x py-20 text-center">Loading…</div>;
  if (!user) return <div className="container-x py-20 text-center">Please <Link href="/login" className="text-accent">log in</Link>.</div>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await clientApi.post('/account/addresses', form);
    setForm(empty);
    setShowForm(false);
    load();
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="container-x max-w-3xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">Addresses</h1>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary">{showForm ? 'Cancel' : 'Add Address'}</button>
      </div>

      {showForm && (
        <form onSubmit={save} className="card mb-6 grid gap-4 p-5 sm:grid-cols-2">
          <input className="input" placeholder="Full name" value={form.fullName} onChange={set('fullName')} required />
          <input className="input" placeholder="Phone (03XXXXXXXXX)" value={form.phone} onChange={set('phone')} required />
          <input className="input sm:col-span-2" placeholder="Address" value={form.addressLine} onChange={set('addressLine')} required />
          <input className="input" placeholder="City" value={form.city} onChange={set('city')} required />
          <Select
            className="w-full"
            value={form.province}
            onChange={(v) => setForm((f) => ({ ...f, province: v }))}
            options={PROVINCES.map((p) => ({ value: p, label: p }))}
          />
          <button className="btn-primary sm:col-span-2">Save Address</button>
        </form>
      )}

      <div className="space-y-3">
        {list.map((a) => (
          <div key={a.id} className="card flex items-start justify-between p-4">
            <div>
              <p className="font-medium">{a.fullName} {a.isDefault && <span className="badge bg-accent/10 text-accent">Default</span>}</p>
              <p className="text-sm text-ink/60">{a.addressLine}, {a.city}, {a.province}</p>
              <p className="text-sm text-ink/60">{a.phone}</p>
            </div>
            <button onClick={async () => { await clientApi.del(`/account/addresses/${a.id}`); load(); }} className="text-ink/40 hover:text-sale">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {list.length === 0 && !showForm && <p className="py-10 text-center text-ink/60">No saved addresses.</p>}
      </div>
    </div>
  );
}
