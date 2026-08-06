import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatPKR } from '@/lib/format';
import { Select } from '@/components/Select';
import { PasswordInput } from '@/components/PasswordInput';

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-brand/10 text-brand',
  STAFF: 'bg-indigo-100 text-indigo-700',
  CUSTOMER: 'bg-stone-200 text-stone-600',
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  isBlocked: boolean;
  createdAt: string;
  lifetimeValue?: number;
  _count?: { orders: number };
}

/**
 * A customer who bought without registering. Not a User row — it's synthesised
 * by grouping orders on the email captured at checkout, so there is no id, no
 * role and nothing to edit or block.
 */
interface GuestRow {
  email: string;
  name: string;
  phone: string | null;
  city: string | null;
  ordersCount: number;
  cancelledCount: number;
  lifetimeValue: number;
  firstOrderAt: string;
  lastOrderAt: string;
  hasAccount: boolean;
}

const emptyForm = { name: '', email: '', phone: '', role: 'CUSTOMER', password: '', isBlocked: false };

export function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [guestsOnly, setGuestsOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [buyersOnly, setBuyersOnly] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    const q = new URLSearchParams({ pageSize: '100' });
    if (search) q.set('search', search);
    if (guestsOnly) {
      // Guests come from a different source — orders grouped by email, not users.
      api.get<{ items: GuestRow[] }>(`/admin/users/guests?${q}`).then((d) => setGuests(d.items));
      return;
    }
    if (roleFilter) q.set('role', roleFilter);
    if (buyersOnly) q.set('hasOrders', 'true');
    api.get<{ items: UserRow[] }>(`/admin/users?${q}`).then((d) => setUsers(d.items));
  };
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, buyersOnly, guestsOnly]);

  const openCreate = () => {
    setForm(emptyForm);
    setError(null);
    setModal({ open: true });
  };
  const openEdit = (u: UserRow) => {
    setForm({ name: u.name, email: u.email, phone: u.phone ?? '', role: u.role, password: '', isBlocked: u.isBlocked });
    setError(null);
    setModal({ open: true, id: u.id });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (modal.id) {
        const payload: any = { name: form.name, email: form.email, phone: form.phone || null, role: form.role, isBlocked: form.isBlocked };
        if (form.password) payload.password = form.password;
        await api.patch(`/admin/users/${modal.id}`, payload);
      } else {
        await api.post('/admin/users', {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          role: form.role,
          password: form.password,
          isBlocked: form.isBlocked,
        });
      }
      setModal({ open: false });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u: UserRow) => {
    if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    try {
      await api.del(`/admin/users/${u.id}`);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Customers &amp; Users</h1>
        {/* Guests have no account, so there is nothing to create or edit here. */}
        {!guestsOnly && (
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder={guestsOnly ? 'Search name, email or phone…' : 'Search name or email…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {/* Role and "bought something" apply to accounts only — every guest by
            definition bought something and has no role. */}
        {!guestsOnly && (
          <>
            <Select
              className="w-44"
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: '', label: 'All roles' },
                { value: 'CUSTOMER', label: 'Customers' },
                { value: 'STAFF', label: 'Staff' },
                { value: 'ADMIN', label: 'Admins' },
              ]}
            />
            <label className="flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <input type="checkbox" checked={buyersOnly} onChange={(e) => setBuyersOnly(e.target.checked)} />
              Bought something
            </label>
          </>
        )}
        <label
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            guestsOnly ? 'border-brand bg-brand/5 text-brand' : 'border-stone-300 bg-white'
          }`}
        >
          <input
            type="checkbox"
            checked={guestsOnly}
            onChange={(e) => setGuestsOnly(e.target.checked)}
          />
          Guest customers only
        </label>
      </div>

      {guestsOnly && (
        <p className="mb-3 text-sm text-stone-500">
          Customers who ordered without creating an account, grouped by the email they
          checked out with. {guests.length} found.
        </p>
      )}

      {guestsOnly ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[42rem]">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr>
                <th className="th">Name</th>
                <th className="th">Email</th>
                <th className="th">Phone</th>
                <th className="th">City</th>
                <th className="th">Orders</th>
                <th className="th text-right">Lifetime Value</th>
                <th className="th">First Order</th>
                <th className="th">Last Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {guests.map((g) => (
                <tr key={g.email} className="hover:bg-stone-50">
                  <td className="td font-medium">
                    {g.name}
                    {/* They registered later with the same email — the same
                        person also appears in the accounts list. */}
                    {g.hasAccount && (
                      <span className="ml-2 badge bg-indigo-100 text-indigo-700">Has account</span>
                    )}
                  </td>
                  <td className="td text-stone-600">{g.email}</td>
                  <td className="td text-stone-600">{g.phone ?? '—'}</td>
                  <td className="td text-stone-600">{g.city ?? '—'}</td>
                  <td className="td">
                    {g.ordersCount}
                    {g.cancelledCount > 0 && (
                      <span className="ml-1 text-xs text-red-600">({g.cancelledCount} cancelled)</span>
                    )}
                  </td>
                  <td className="td text-right font-medium">{formatPKR(g.lifetimeValue)}</td>
                  <td className="td text-xs text-stone-500">{formatDate(g.firstOrderAt)}</td>
                  <td className="td text-xs text-stone-500">{formatDate(g.lastOrderAt)}</td>
                </tr>
              ))}
              {guests.length === 0 && (
                <tr>
                  <td className="td text-stone-500" colSpan={8}>
                    No guest customers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[42rem]">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="th">Name</th>
              <th className="th">Email</th>
              <th className="th">Role</th>
              <th className="th">Status</th>
              <th className="th">Orders</th>
              <th className="th text-right">Lifetime Value</th>
              <th className="th">Joined</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-stone-50">
                <td className="td font-medium">{u.name}</td>
                <td className="td text-stone-600">{u.email}<p className="text-xs text-stone-400">{u.phone}</p></td>
                <td className="td"><span className={`badge ${ROLE_BADGE[u.role]}`}>{u.role}</span></td>
                <td className="td">
                  {u.isBlocked ? <span className="badge bg-red-100 text-red-700">Blocked</span> : <span className="badge bg-green-100 text-green-700">Active</span>}
                </td>
                <td className="td">{u._count?.orders ?? 0}</td>
                <td className="td text-right font-medium">{formatPKR(u.lifetimeValue ?? 0)}</td>
                <td className="td text-xs text-stone-500">{formatDate(u.createdAt)}</td>
                <td className="td">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(u)} className="text-stone-500 hover:text-brand"><Pencil size={16} /></button>
                    <button onClick={() => remove(u)} className="text-stone-500 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td className="td text-stone-500" colSpan={8}>No users found.</td></tr>}
          </tbody>
        </table>
      </div>
      )}

      {/* Create / Edit modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal({ open: false })} />
          <form onSubmit={save} className="relative z-10 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold">{modal.id ? 'Edit User' : 'Add User'}</h2>
              <button type="button" onClick={() => setModal({ open: false })} className="text-stone-400 hover:text-stone-700"><X /></button>
            </div>

            {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Name</label><input className="input" value={form.name} onChange={set('name')} required /></div>
              <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={set('email')} required /></div>
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} placeholder="03XXXXXXXXX" /></div>
              <div><label className="label">Role</label>
                <Select
                  value={form.role}
                  onChange={(v) => setForm((f) => ({ ...f, role: v }))}
                  options={[
                    { value: 'CUSTOMER', label: 'Customer' },
                    { value: 'STAFF', label: 'Staff' },
                    { value: 'ADMIN', label: 'Admin' },
                  ]}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">{modal.id ? 'New password (leave blank to keep)' : 'Password'}</label>
                <PasswordInput value={form.password} onChange={set('password')} required={!modal.id} minLength={8} />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={form.isBlocked} onChange={(e) => setForm((f) => ({ ...f, isBlocked: e.target.checked }))} />
                Blocked (cannot log in)
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setModal({ open: false })} className="btn-outline">Cancel</button>
              <button disabled={busy} className="btn-primary">{busy ? 'Saving…' : modal.id ? 'Save Changes' : 'Create User'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
