import { useEffect, useState } from 'react';
import { Eye, EyeOff, Megaphone, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { announcementPlacements } from '@store/shared-types';
import { api, ApiError, uploadImage } from '@/lib/api';
import { Select } from '@/components/Select';

/*
 * Event announcements — Eid, 14 August, a flash sale, a shipping notice.
 *
 * The date window is the point: an announcement can be written days ahead and it
 * appears and retires on its own. The storefront shows a dismissible ribbon and
 * (once per shopper) a modal.
 */

interface Announcement {
  id: string;
  title: string;
  message?: string | null;
  badge?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  couponCode?: string | null;
  placement: 'modal' | 'ribbon' | 'both';
  showCountdown: boolean;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  sortOrder: number;
}

const empty = {
  title: '',
  message: '',
  badge: '',
  imageUrl: '',
  ctaLabel: 'Shop the sale',
  ctaUrl: '',
  couponCode: '',
  placement: 'both' as Announcement['placement'],
  showCountdown: false,
  isActive: true,
  startDate: '',
  endDate: '',
};

const PLACEMENT_LABELS: Record<string, string> = {
  both: 'Ribbon + one-time popup',
  ribbon: 'Ribbon under the header only',
  modal: 'One-time popup only',
};

/** `datetime-local` needs "YYYY-MM-DDTHH:mm" in local time, not an ISO string. */
function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Live / Scheduled / Ended / Hidden — what a shopper sees right now. */
function status(a: Announcement): { label: string; className: string } {
  if (!a.isActive) return { label: 'Hidden', className: 'bg-stone-100 text-stone-500' };
  const now = Date.now();
  if (a.startDate && new Date(a.startDate).getTime() > now)
    return { label: 'Scheduled', className: 'bg-amber-50 text-amber-700' };
  if (a.endDate && new Date(a.endDate).getTime() < now)
    return { label: 'Ended', className: 'bg-stone-100 text-stone-500' };
  return { label: 'Live', className: 'bg-green-50 text-green-700' };
}

export function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [modal, setModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () =>
    api.get<{ announcements: Announcement[] }>('/admin/announcements').then((d) => setItems(d.announcements));
  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm(empty);
    setError(null);
    setModal({ open: true });
  };

  const openEdit = (a: Announcement) => {
    setForm({
      title: a.title,
      message: a.message ?? '',
      badge: a.badge ?? '',
      imageUrl: a.imageUrl ?? '',
      ctaLabel: a.ctaLabel ?? '',
      ctaUrl: a.ctaUrl ?? '',
      couponCode: a.couponCode ?? '',
      placement: a.placement,
      showCountdown: a.showCountdown,
      isActive: a.isActive,
      startDate: toLocalInput(a.startDate),
      endDate: toLocalInput(a.endDate),
    });
    setError(null);
    setModal({ open: true, id: a.id });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.showCountdown && !form.endDate) {
      return setError('A countdown needs an end date — set one, or turn the countdown off.');
    }
    if (form.startDate && form.endDate && new Date(form.startDate) >= new Date(form.endDate)) {
      return setError('The end date has to be after the start date.');
    }
    setBusy(true);
    setError(null);
    // Empty strings mean "not set", which the API stores as null.
    const payload = {
      ...form,
      message: form.message || null,
      badge: form.badge || null,
      imageUrl: form.imageUrl || null,
      ctaLabel: form.ctaLabel || null,
      ctaUrl: form.ctaUrl || null,
      couponCode: form.couponCode || null,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
    };
    try {
      if (modal.id) await api.put(`/admin/announcements/${modal.id}`, payload);
      else await api.post('/admin/announcements', { ...payload, sortOrder: items.length });
      setModal({ open: false });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (a: Announcement) => {
    await api.put(`/admin/announcements/${a.id}`, { isActive: !a.isActive });
    load();
  };

  const remove = async (a: Announcement) => {
    if (!confirm(`Delete “${a.title}”?`)) return;
    await api.del(`/admin/announcements/${a.id}`);
    load();
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      setForm((f) => ({ ...f, imageUrl: '' }));
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
      <h1 className="mb-1 font-serif text-2xl font-bold">Announcements</h1>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-stone-500">
          Event sales and store-wide notices — Eid, 14 August, a flash sale. Set the dates and it appears
          and retires on its own. Shoppers see a slim ribbon under the header, and the popup shows once
          each (never on the cart or checkout).
        </p>
        <button onClick={openCreate} className="btn-primary shrink-0">
          <Plus size={16} /> New Announcement
        </button>
      </div>

      <div className="space-y-3">
        {items.map((a) => {
          const s = status(a);
          return (
            <div key={a.id} className="card flex items-center gap-4 p-3">
              {a.imageUrl ? (
                <img src={a.imageUrl} alt="" className="h-14 w-20 shrink-0 rounded object-cover" />
              ) : (
                <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded bg-stone-100 text-stone-400">
                  <Megaphone size={18} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{a.title}</p>
                  <span className={`badge shrink-0 ${s.className}`}>{s.label}</span>
                </div>
                <p className="truncate text-xs text-stone-500">{a.message}</p>
                <p className="mt-0.5 truncate text-xs text-stone-400">
                  {PLACEMENT_LABELS[a.placement]}
                  {a.startDate || a.endDate ? ' · ' : ''}
                  {a.startDate ? new Date(a.startDate).toLocaleString() : ''}
                  {a.endDate ? ` → ${new Date(a.endDate).toLocaleString()}` : ''}
                </p>
              </div>
              <button
                onClick={() => toggle(a)}
                className={a.isActive ? 'text-green-600' : 'text-stone-400'}
                title={a.isActive ? 'Visible' : 'Hidden'}
              >
                {a.isActive ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <button onClick={() => openEdit(a)} className="text-stone-500 hover:text-brand">
                <Pencil size={16} />
              </button>
              <button onClick={() => remove(a)} className="text-stone-500 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="card p-6 text-center text-stone-500">
            No announcements yet. Create one for your next event sale.
          </p>
        )}
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal({ open: false })} />
          <form
            onSubmit={save}
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold">
                {modal.id ? 'Edit Announcement' : 'New Announcement'}
              </h2>
              <button
                type="button"
                onClick={() => setModal({ open: false })}
                className="text-stone-400 hover:text-stone-700"
              >
                <X />
              </button>
            </div>
            {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Badge</label>
                  <input
                    className="input"
                    placeholder="Eid Sale"
                    value={form.badge}
                    onChange={(e) => setForm({ ...form, badge: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Headline *</label>
                  <input
                    className="input"
                    required
                    placeholder="Up to 50% off for Eid"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Message</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Three days only — free delivery on every order above Rs. 3,000."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Popup image (optional)</label>
                {form.imageUrl && <img src={form.imageUrl} alt="" className="mb-2 h-28 w-full rounded object-cover" />}
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="Image URL or upload →"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  />
                  <label className="btn-outline cursor-pointer whitespace-nowrap">
                    <Upload size={16} /> {uploading ? '…' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        onFile(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Button text</label>
                  <input
                    className="input"
                    placeholder="Shop the sale"
                    value={form.ctaLabel}
                    onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Button link</label>
                  <input
                    className="input"
                    placeholder="/category/sale"
                    value={form.ctaUrl}
                    onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Discount code (optional)</label>
                  <input
                    className="input"
                    placeholder="EID50"
                    value={form.couponCode}
                    onChange={(e) => setForm({ ...form, couponCode: e.target.value.toUpperCase() })}
                  />
                  <p className="mt-1 text-xs text-stone-400">Shown as a tap-to-copy chip in the popup.</p>
                </div>
                <div>
                  <label className="label">Where it shows</label>
                  <Select
                    value={form.placement}
                    onChange={(v) => setForm({ ...form, placement: v as Announcement['placement'] })}
                    options={announcementPlacements.map((p) => ({ value: p, label: PLACEMENT_LABELS[p] }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Starts (optional)</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-stone-400">Blank = as soon as it's active.</p>
                </div>
                <div>
                  <label className="label">Ends (optional)</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-stone-400">Blank = until you switch it off.</p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.showCountdown}
                  onChange={(e) => setForm({ ...form, showCountdown: e.target.checked })}
                />
                Show a live countdown to the end date
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active (within its dates, shoppers will see it)
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setModal({ open: false })} className="btn-outline">
                Cancel
              </button>
              <button disabled={busy} className="btn-primary">
                {busy ? 'Saving…' : modal.id ? 'Save' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
