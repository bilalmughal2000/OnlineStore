import { useEffect, useMemo, useState } from 'react';
import { Mail, Eye, Send, RotateCcw, Save, Palette } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { RichTextEditor } from '@/components/RichTextEditor';

/**
 * Email designer.
 *
 * Templates hold only the BODY — the branded shell (logo, colours, footer) is
 * applied when the email is sent, so heavy edits can't take an email off brand
 * or break its layout in Outlook. Anything saved here can be reverted to the
 * built-in default, which is the escape hatch for a bad edit.
 */

interface Template {
  key: string;
  name: string;
  description: string;
  variables: Record<string, string>;
  subject: string;
  html: string;
  isCustomised: boolean;
  hasDraft: boolean;
  defaultSubject: string;
  defaultHtml: string;
}

interface Branding {
  storeName?: string;
  accentColor?: string;
  logoUrl?: string;
  headerImageUrl?: string;
  footerText?: string;
  supportEmail?: string;
  supportPhone?: string;
}

const blankBranding: Branding = {
  storeName: '',
  accentColor: '#B4530A',
  logoUrl: '',
  headerImageUrl: '',
  footerText: '',
  supportEmail: '',
  supportPhone: '',
};

export function Emails() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeKey, setActiveKey] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [branding, setBranding] = useState<Branding>(blankBranding);
  const [preview, setPreview] = useState<string>('');
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const active = useMemo(() => templates.find((t) => t.key === activeKey), [templates, activeKey]);
  const dirty = active ? subject !== active.subject || html !== active.html : false;

  const loadTemplates = async () => {
    const d = await api.get<{ templates: Template[] }>('/admin/email/templates');
    setTemplates(d.templates);
    if (!activeKey && d.templates[0]) selectTemplate(d.templates[0]);
  };

  useEffect(() => {
    loadTemplates();
    api.get<{ settings: Record<string, any> }>('/admin/settings').then((d) => {
      setBranding({ ...blankBranding, ...(d.settings.email ?? {}) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTemplate = (t: Template) => {
    setActiveKey(t.key);
    setSubject(t.subject);
    setHtml(t.html);
    setPreview('');
    setMsg(null);
  };

  const flash = (kind: 'ok' | 'err', text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const saveBranding = async () => {
    setBusy(true);
    try {
      await api.put('/admin/settings/email', { value: branding });
      flash('ok', 'Email branding saved.');
      setPreview('');
    } catch (e) {
      flash('err', e instanceof ApiError ? e.message : 'Could not save branding');
    } finally {
      setBusy(false);
    }
  };

  const saveTemplate = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await api.put(`/admin/email/templates/${active.key}`, { subject, html, isEnabled: true });
      await loadTemplates();
      flash('ok', `"${active.name}" saved. It's live from the next email.`);
    } catch (e) {
      flash('err', e instanceof ApiError ? e.message : 'Could not save template');
    } finally {
      setBusy(false);
    }
  };

  const resetTemplate = async () => {
    if (!active) return;
    if (!confirm(`Discard your version of "${active.name}" and go back to the built-in default?`)) return;
    setBusy(true);
    try {
      await api.del(`/admin/email/templates/${active.key}`);
      const d = await api.get<{ templates: Template[] }>('/admin/email/templates');
      setTemplates(d.templates);
      const fresh = d.templates.find((t) => t.key === active.key);
      if (fresh) selectTemplate(fresh);
      flash('ok', 'Restored the default.');
    } catch (e) {
      flash('err', e instanceof ApiError ? e.message : 'Could not reset');
    } finally {
      setBusy(false);
    }
  };

  const doPreview = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const d = await api.post<{ html: string; subject: string }>(
        `/admin/email/templates/${active.key}/preview`,
        { subject, html },
      );
      setPreview(d.html);
    } catch (e) {
      flash('err', e instanceof ApiError ? e.message : 'Could not render preview');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    if (!active || !testTo.trim()) return flash('err', 'Enter an email address first.');
    setBusy(true);
    try {
      const r = await api.post<{ ok: boolean; error?: string; transport?: string }>(
        `/admin/email/templates/${active.key}/test`,
        { to: testTo.trim(), subject, html },
      );
      // The API returns the real send failure rather than hiding it in a log.
      flash(r.ok ? 'ok' : 'err', r.ok ? `Test sent to ${testTo} via ${r.transport}.` : r.error || 'Send failed');
    } catch (e) {
      flash('err', e instanceof ApiError ? e.message : 'Could not send test');
    } finally {
      setBusy(false);
    }
  };

  const setB = (k: keyof Branding) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setBranding((b) => ({ ...b, [k]: e.target.value }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">Emails</h1>
          <p className="text-sm text-stone-500">
            Design the emails your customers receive. Branding applies to all of them.
          </p>
        </div>
      </div>

      {msg && (
        <p
          className={`mb-4 rounded p-2 text-sm ${msg.kind === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}
        >
          {msg.text}
        </p>
      )}

      {/* ── Branding ───────────────────────────────────────── */}
      <div className="card mb-6 p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Palette size={16} /> Branding
        </h2>
        <p className="mb-4 text-sm text-stone-500">
          Applied to every email — header, colours and footer.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Store name</label>
            <input className="input" value={branding.storeName ?? ''} onChange={setB('storeName')} placeholder="Aabroo" />
          </div>
          <div>
            <label className="label">Accent colour</label>
            <div className="flex gap-2">
              <input
                type="color"
                className="h-10 w-12 cursor-pointer rounded border border-stone-300"
                value={branding.accentColor || '#B4530A'}
                onChange={setB('accentColor')}
              />
              <input className="input flex-1" value={branding.accentColor ?? ''} onChange={setB('accentColor')} />
            </div>
          </div>
          <div>
            <label className="label">Logo URL</label>
            <input className="input" value={branding.logoUrl ?? ''} onChange={setB('logoUrl')} placeholder="https://…/logo.png" />
            <p className="mt-1 text-xs text-stone-400">Shown instead of the store name.</p>
          </div>
          <div>
            <label className="label">Header image / GIF URL</label>
            <input className="input" value={branding.headerImageUrl ?? ''} onChange={setB('headerImageUrl')} placeholder="https://…/banner.gif" />
            <p className="mt-1 text-xs text-stone-400">A banner under the header. Animated GIFs work.</p>
          </div>
          <div>
            <label className="label">Support email</label>
            <input className="input" value={branding.supportEmail ?? ''} onChange={setB('supportEmail')} />
          </div>
          <div>
            <label className="label">Support phone</label>
            <input className="input" value={branding.supportPhone ?? ''} onChange={setB('supportPhone')} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label">Footer text</label>
            <input className="input" value={branding.footerText ?? ''} onChange={setB('footerText')} placeholder="Free delivery over Rs 3,000 · Cash on Delivery available" />
          </div>
        </div>
        <button onClick={saveBranding} disabled={busy} className="btn-primary mt-4">
          <Save size={15} /> Save branding
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* ── Template list ───────────────────────────────── */}
        <div className="card h-fit overflow-hidden">
          {templates.map((t) => (
            <button
              key={t.key}
              onClick={() => selectTemplate(t)}
              className={`flex w-full items-start gap-2 border-b border-stone-100 p-3 text-left last:border-0 ${
                t.key === activeKey ? 'bg-brand/5' : 'hover:bg-stone-50'
              }`}
            >
              <Mail size={15} className={t.key === activeKey ? 'mt-0.5 text-brand' : 'mt-0.5 text-stone-400'} />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t.name}</span>
                {t.isCustomised && <span className="badge mt-1 bg-indigo-100 text-indigo-700">Customised</span>}
              </span>
            </button>
          ))}
        </div>

        {/* ── Editor ──────────────────────────────────────── */}
        {active && (
          <div className="space-y-4">
            <div className="card p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{active.name}</h2>
                  <p className="text-sm text-stone-500">{active.description}</p>
                </div>
                {active.hasDraft && (
                  <button onClick={resetTemplate} disabled={busy} className="btn-outline shrink-0 text-xs">
                    <RotateCcw size={14} /> Reset to default
                  </button>
                )}
              </div>

              <label className="label">Subject line</label>
              <input className="input mb-4" value={subject} onChange={(e) => setSubject(e.target.value)} />

              <label className="label">Content</label>
              <RichTextEditor value={html} onChange={setHtml} />

              {/* Placeholders are the only way to get real order data into the
                  copy, so they're listed rather than left to be guessed. */}
              <div className="mt-4 rounded-md bg-stone-50 p-3">
                <p className="mb-2 text-xs font-medium text-stone-600">
                  Available placeholders — type them into the subject or content:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(active.variables).map(([name, desc]) => (
                    <span
                      key={name}
                      title={desc}
                      className="cursor-help rounded bg-white px-2 py-1 font-mono text-[11px] text-stone-700 ring-1 ring-stone-200"
                    >
                      {`{{${name}}}`}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button onClick={saveTemplate} disabled={busy || !dirty} className="btn-primary">
                  <Save size={15} /> {dirty ? 'Save changes' : 'Saved'}
                </button>
                <button onClick={doPreview} disabled={busy} className="btn-outline">
                  <Eye size={15} /> Preview
                </button>
                <span className="mx-1 h-5 w-px bg-stone-200" />
                <input
                  className="input w-56"
                  placeholder="you@example.com"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
                <button onClick={sendTest} disabled={busy} className="btn-outline">
                  <Send size={15} /> Send test
                </button>
              </div>
            </div>

            {preview && (
              <div className="card overflow-hidden">
                <p className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-xs text-stone-500">
                  Preview — rendered with sample data, exactly as a customer would see it
                </p>
                {/* srcDoc sandboxes the email HTML so its styles can't leak into
                    the admin, and shows it at a realistic width. */}
                <iframe
                  title="Email preview"
                  srcDoc={preview}
                  sandbox=""
                  className="h-[680px] w-full border-0 bg-stone-100"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
