import { useEffect, useState } from 'react';
import { Pencil, ArrowLeft, Plus, ExternalLink } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { RichTextEditor } from '@/components/RichTextEditor';
import { slugify } from '@/lib/format';

interface StaticPage {
  slug: string;
  title: string;
  content: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isPublished: boolean;
}

const blank: StaticPage = { slug: '', title: '', content: '', seoTitle: '', seoDescription: '', isPublished: true };
const STOREFRONT = (import.meta.env.VITE_STOREFRONT_URL as string) ?? 'http://localhost:3000';

export function Pages() {
  const [pages, setPages] = useState<StaticPage[]>([]);
  const [editing, setEditing] = useState<StaticPage | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => api.get<{ pages: StaticPage[] }>('/admin/pages').then((d) => setPages(d.pages));
  useEffect(() => { load(); }, []);

  const edit = (p: StaticPage) => { setEditing({ ...p }); setIsNew(false); setError(null); setSaved(false); };
  const create = () => { setEditing({ ...blank }); setIsNew(true); setError(null); setSaved(false); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const slug = isNew ? slugify(editing.slug || editing.title) : editing.slug;
    if (!slug) return setError('Slug is required');
    setBusy(true);
    setError(null);
    try {
      await api.put(`/admin/pages/${slug}`, {
        slug,
        title: editing.title,
        content: editing.content,
        seoTitle: editing.seoTitle || undefined,
        seoDescription: editing.seoDescription || undefined,
        isPublished: editing.isPublished,
      });
      setSaved(true);
      await load();
      setTimeout(() => setSaved(false), 2000);
      if (isNew) setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  // ── Editor view ──
  if (editing) {
    const upd = (patch: Partial<StaticPage>) => setEditing((p) => (p ? { ...p, ...patch } : p));
    return (
      <form onSubmit={save} className="max-w-4xl">
        <button type="button" onClick={() => setEditing(null)} className="mb-4 flex items-center gap-1 text-sm text-stone-500">
          <ArrowLeft size={16} /> Back to pages
        </button>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-2xl font-bold">{isNew ? 'New Page' : `Edit: ${editing.title}`}</h1>
          {!isNew && (
            <a href={`${STOREFRONT}/page/${editing.slug}`} target="_blank" rel="noreferrer" className="btn-outline text-xs">
              <ExternalLink size={14} /> View
            </a>
          )}
        </div>

        {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

        <div className="space-y-5">
          <div className="card grid gap-4 p-5 sm:grid-cols-2">
            <div><label className="label">Title</label><input className="input" value={editing.title} onChange={(e) => upd({ title: e.target.value })} required /></div>
            <div>
              <label className="label">Slug (URL)</label>
              <input className="input disabled:bg-stone-100" value={isNew ? editing.slug : editing.slug} onChange={(e) => upd({ slug: e.target.value })} disabled={!isNew} placeholder="about-us" />
              {!isNew && <p className="mt-1 text-xs text-stone-400">/page/{editing.slug}</p>}
            </div>
          </div>

          <div className="card p-5">
            <label className="label">Content</label>
            <RichTextEditor value={editing.content} onChange={(html) => upd({ content: html })} />
          </div>

          <div className="card grid gap-4 p-5 sm:grid-cols-2">
            <h2 className="font-semibold sm:col-span-2">SEO</h2>
            <div><label className="label">Meta Title</label><input className="input" value={editing.seoTitle ?? ''} onChange={(e) => upd({ seoTitle: e.target.value })} /></div>
            <div><label className="label">Meta Description</label><input className="input" value={editing.seoDescription ?? ''} onChange={(e) => upd({ seoDescription: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={editing.isPublished} onChange={(e) => upd({ isPublished: e.target.checked })} /> Published (visible on storefront)
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save Page'}</button>
            {saved && <span className="text-sm text-green-700">Saved ✓</span>}
          </div>
        </div>
      </form>
    );
  }

  // ── List view ──
  return (
    <div className="max-w-3xl">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Pages</h1>
        <button onClick={create} className="btn-primary"><Plus size={16} /> Add Page</button>
      </div>
      <p className="mb-6 text-sm text-stone-500">Manage the content of your static pages (About, Contact, Policies…).</p>

      <div className="card divide-y divide-stone-100">
        {pages.map((p) => (
          <div key={p.slug} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">
                {p.title}{' '}
                {!p.isPublished && <span className="badge bg-stone-200 text-stone-600">Draft</span>}
              </p>
              <p className="text-xs text-stone-400">/page/{p.slug}</p>
            </div>
            <button onClick={() => edit(p)} className="btn-outline text-xs"><Pencil size={14} /> Edit</button>
          </div>
        ))}
        {pages.length === 0 && <p className="p-6 text-center text-stone-500">No pages yet.</p>}
      </div>
    </div>
  );
}
