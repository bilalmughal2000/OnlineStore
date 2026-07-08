import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Select } from '@/components/Select';

export function Categories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', parentId: '' });

  const load = () => api.get<{ categories: any[] }>('/admin/categories').then((d) => setCategories(d.categories));
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/admin/categories', { name: form.name, parentId: form.parentId || null });
    setForm({ name: '', parentId: '' });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete category?')) return;
    await api.del(`/admin/categories/${id}`);
    load();
  };

  const parents = categories.filter((c) => !c.parentId);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 font-serif text-2xl font-bold">Categories</h1>

      <form onSubmit={create} className="card mb-6 flex items-end gap-3 p-5">
        <div className="flex-1">
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="flex-1">
          <label className="label">Parent (optional)</label>
          <Select
            value={form.parentId}
            onChange={(v) => setForm({ ...form, parentId: v })}
            options={[{ value: '', label: '— Top level —' }, ...parents.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
        <button className="btn-primary"><Plus size={16} /> Add</button>
      </form>

      <div className="card divide-y divide-stone-100">
        {parents.map((p) => (
          <div key={p.id} className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{p.name} <span className="text-xs text-stone-400">({p._count?.products ?? 0})</span></span>
              <button onClick={() => remove(p.id)} className="text-stone-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
            <div className="mt-2 space-y-1 pl-4">
              {categories.filter((c) => c.parentId === p.id).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm text-stone-600">
                  <span>› {c.name} <span className="text-xs text-stone-400">({c._count?.products ?? 0})</span></span>
                  <button onClick={() => remove(c.id)} className="text-stone-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
