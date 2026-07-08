import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatPKR } from '@/lib/format';

const blank = { code: '', type: 'PERCENTAGE', value: 10, minOrderValue: 0 };

export function Coupons() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.get<{ coupons: any[] }>('/admin/coupons').then((d) => setCoupons(d.coupons));
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/admin/coupons', { ...form, value: Number(form.value), minOrderValue: Number(form.minOrderValue) });
      setForm(blank);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed');
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 font-serif text-2xl font-bold">Coupons</h1>

      <form onSubmit={create} className="card mb-6 grid grid-cols-2 items-end gap-4 p-5 md:grid-cols-4">
        <div><label className="label">Code</label><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required /></div>
        <div><label className="label">Type</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed (PKR)</option>
          </select>
        </div>
        <div><label className="label">Value</label><input type="number" className="input" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></div>
        <div><label className="label">Min Order</label><input type="number" className="input" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: Number(e.target.value) })} /></div>
        <button className="btn-primary md:col-span-4"><Plus size={16} /> Create Coupon</button>
      </form>
      {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr><th className="th">Code</th><th className="th">Discount</th><th className="th">Min Order</th><th className="th">Used</th><th className="th text-right"></th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="td font-mono font-medium">{c.code}</td>
                <td className="td">{c.type === 'PERCENTAGE' ? `${c.value}%` : formatPKR(c.value)}</td>
                <td className="td">{formatPKR(c.minOrderValue)}</td>
                <td className="td">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                <td className="td text-right">
                  <button onClick={async () => { await api.del(`/admin/coupons/${c.id}`); load(); }} className="text-stone-400 hover:text-red-600"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && <tr><td className="td text-stone-500" colSpan={5}>No coupons.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
