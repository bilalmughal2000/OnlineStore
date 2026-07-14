import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Upload, ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';
import { api, ApiError, uploadImage } from '@/lib/api';

interface Banner {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  imageUrl: string;
  link?: string | null;
  isActive: boolean;
  sortOrder: number;
}

const empty = { title: '', subtitle: '', ctaLabel: 'Shop Now', imageUrl: '', link: '', isActive: true };

export function Banners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [modal, setModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () =>
    api.get<{ banners: Banner[] }>('/admin/banners').then((d) => setBanners(d.banners.filter((b: any) => b.position !== 'strip')));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(empty); setError(null); setModal({ open: true }); };
  const openEdit = (b: Banner) => {
    setForm({ title: b.title ?? '', subtitle: b.subtitle ?? '', ctaLabel: b.ctaLabel ?? 'Shop Now', imageUrl: b.imageUrl, link: b.link ?? '', isActive: b.isActive });
    setError(null);
    setModal({ open: true, id: b.id });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.imageUrl) return setError('A banner image is required');
    setBusy(true);
    setError(null);
    const payload = { ...form, position: 'hero', title: form.title || null, subtitle: form.subtitle || null, ctaLabel: form.ctaLabel || null, link: form.link || null };
    try {
      if (modal.id) await api.put(`/admin/banners/${modal.id}`, payload);
      else await api.post('/admin/banners', { ...payload, sortOrder: banners.length });
      setModal({ open: false });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (b: Banner) => { await api.put(`/admin/banners/${b.id}`, { isActive: !b.isActive }); load(); };
  const remove = async (id: string) => { if (confirm('Delete this banner?')) { await api.del(`/admin/banners/${id}`); load(); } };
  const move = async (i: number, dir: -1 | 1) => {
    const next = [...banners];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setBanners(next);
    await api.post('/admin/banners/reorder', { order: next.map((b) => b.id) });
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, 'products');
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Hero Banners</h1>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Add Banner</button>
      </div>
      <p className="mb-6 text-sm text-stone-500">Manage the homepage hero carousel — image, heading, subheading, and button.</p>

      <div className="space-y-3">
        {banners.map((b, i) => (
          <div key={b.id} className="card flex items-center gap-4 p-3">
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} className="text-stone-400 hover:text-brand"><ArrowUp size={14} /></button>
              <button onClick={() => move(i, 1)} className="text-stone-400 hover:text-brand"><ArrowDown size={14} /></button>
            </div>
            <img src={b.imageUrl} alt="" className="h-14 w-28 shrink-0 rounded object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{b.title || <span className="text-stone-400">(no heading)</span>}</p>
              <p className="truncate text-xs text-stone-500">{b.subtitle}</p>
              <p className="truncate text-xs text-stone-400">{b.link}</p>
            </div>
            <button onClick={() => toggle(b)} className={b.isActive ? 'text-green-600' : 'text-stone-400'} title={b.isActive ? 'Active' : 'Hidden'}>
              {b.isActive ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            <button onClick={() => openEdit(b)} className="text-stone-500 hover:text-brand"><Pencil size={16} /></button>
            <button onClick={() => remove(b.id)} className="text-stone-500 hover:text-red-600"><Trash2 size={16} /></button>
          </div>
        ))}
        {banners.length === 0 && <p className="card p-6 text-center text-stone-500">No banners yet.</p>}
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal({ open: false })} />
          <form onSubmit={save} className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold">{modal.id ? 'Edit Banner' : 'Add Banner'}</h2>
              <button type="button" onClick={() => setModal({ open: false })} className="text-stone-400 hover:text-stone-700"><X /></button>
            </div>
            {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

            <div className="space-y-4">
              <div>
                <label className="label">Banner image</label>
                {form.imageUrl && <img src={form.imageUrl} alt="" className="mb-2 h-28 w-full rounded object-cover" />}
                <div className="flex gap-2">
                  <input className="input" placeholder="Image URL or upload →" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
                  <label className="btn-outline cursor-pointer whitespace-nowrap">
                    <Upload size={16} /> {uploading ? '…' : 'Upload'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                </div>
              </div>
              <div><label className="label">Heading</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Summer Lawn Collection" /></div>
              <div><label className="label">Subheading</label><input className="input" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Up to 50% off" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Button text</label><input className="input" value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} placeholder="Shop Now" /></div>
                <div><label className="label">Button link</label><input className="input" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/category/women" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active (visible on homepage)
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setModal({ open: false })} className="btn-outline">Cancel</button>
              <button disabled={busy} className="btn-primary">{busy ? 'Saving…' : modal.id ? 'Save Banner' : 'Create Banner'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
