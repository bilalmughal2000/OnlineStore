import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatPKR } from '@/lib/format';

export function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const load = () => api.get<{ customers: any[] }>(`/admin/orders/customers/list${search ? `?search=${encodeURIComponent(search)}` : ''}`).then((d) => setCustomers(d.customers));
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleBlock = async (c: any) => {
    await api.patch(`/admin/orders/customers/${c.id}/block`, { isBlocked: !c.isBlocked });
    load();
  };

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-bold">Customers</h1>
      <input className="input mb-4 max-w-xs" placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr><th className="th">Name</th><th className="th">Email</th><th className="th">Orders</th><th className="th text-right">Lifetime Value</th><th className="th text-right"></th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="td font-medium">{c.name} {c.isBlocked && <span className="badge bg-red-100 text-red-700">Blocked</span>}</td>
                <td className="td text-stone-600">{c.email}<p className="text-xs text-stone-400">{c.phone}</p></td>
                <td className="td">{c.orderCount}</td>
                <td className="td text-right font-medium">{formatPKR(c.lifetimeValue)}</td>
                <td className="td text-right">
                  <button onClick={() => toggleBlock(c)} className="btn-outline text-xs">{c.isBlocked ? 'Unblock' : 'Block'}</button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td className="td text-stone-500" colSpan={5}>No customers.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
