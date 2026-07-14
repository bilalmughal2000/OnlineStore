import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { Select } from '@/components/Select';

const TYPES = ['PRODUCT_GRID', 'CATEGORY_TILES'];

export function Sections() {
  const [sections, setSections] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', type: 'PRODUCT_GRID', filter: 'newest' });

  const load = () => api.get<{ sections: any[] }>('/admin/sections').then((d) => setSections(d.sections));
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const config = form.type === 'PRODUCT_GRID' ? { filter: form.filter, limit: 8 } : {};
    await api.post('/admin/sections', { title: form.title, type: form.type, config, sortOrder: sections.length });
    setForm({ title: '', type: 'PRODUCT_GRID', filter: 'newest' });
    load();
  };

  const toggle = async (s: any) => { await api.put(`/admin/sections/${s.id}`, { isActive: !s.isActive }); load(); };
  const remove = async (id: string) => { await api.del(`/admin/sections/${id}`); load(); };

  const move = async (i: number, dir: -1 | 1) => {
    const next = [...sections];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
    await api.post('/admin/sections/reorder', { order: next.map((s) => s.id) });
  };

  return (
    <div className="max-w-3xl">
      <p className="mb-6 text-sm text-stone-500">Create, reorder, and toggle homepage product & category sections — no code required.</p>

      <form onSubmit={create} className="card mb-6 grid grid-cols-3 items-end gap-4 p-5">
        <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div><label className="label">Type</label>
          <Select
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v })}
            options={TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))}
          />
        </div>
        {form.type === 'PRODUCT_GRID' && (
          <div><label className="label">Populate with</label>
            <Select
              value={form.filter}
              onChange={(v) => setForm({ ...form, filter: v })}
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'featured', label: 'Featured' },
                { value: 'onSale', label: 'On sale' },
              ]}
            />
          </div>
        )}
        <button className="btn-primary col-span-3"><Plus size={16} /> Add Section</button>
      </form>

      <div className="space-y-2">
        {sections.map((s, i) => (
          <div key={s.id} className="card flex items-center gap-3 p-4">
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} className="text-stone-400 hover:text-brand"><ArrowUp size={14} /></button>
              <button onClick={() => move(i, 1)} className="text-stone-400 hover:text-brand"><ArrowDown size={14} /></button>
            </div>
            <div className="flex-1">
              <p className="font-medium">{s.title}</p>
              <p className="text-xs text-stone-500">{s.type.replace(/_/g, ' ')} {s.config?.filter ? `· ${s.config.filter}` : ''}</p>
            </div>
            <button onClick={() => toggle(s)} className={s.isActive ? 'text-green-600' : 'text-stone-400'}>
              {s.isActive ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            <button onClick={() => remove(s.id)} className="text-stone-400 hover:text-red-600"><Trash2 size={16} /></button>
          </div>
        ))}
        {sections.length === 0 && <p className="py-10 text-center text-stone-500">No sections yet.</p>}
      </div>
    </div>
  );
}
