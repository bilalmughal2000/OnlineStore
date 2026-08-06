import { useEffect, useState } from 'react';
import { DEFAULT_THEME } from '@store/shared-types';
import { api } from '@/lib/api';
import { ThemePicker } from '@/components/ThemePicker';

export function Settings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const load = () => api.get<{ settings: Record<string, any> }>('/admin/settings').then((d) => setSettings(d.settings));
  useEffect(() => { load(); }, []);

  const save = async (key: string) => {
    await api.put(`/admin/settings/${key}`, { value: settings[key] });
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  };

  const upd = (key: string, field: string, value: unknown) =>
    setSettings((s) => ({ ...s, [key]: { ...s[key], [field]: value } }));

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-serif text-2xl font-bold">Store Settings</h1>

      {/* Store */}
      <Section title="Store" onSave={() => save('store')} saved={saved === 'store'}>
        <Field label="Store name">
          <input className="input" value={settings.store?.name ?? ''} onChange={(e) => upd('store', 'name', e.target.value)} />
        </Field>
        <Field label="Tagline">
          <input className="input" value={settings.store?.tagline ?? ''} onChange={(e) => upd('store', 'tagline', e.target.value)} />
        </Field>
        <Field label="Promo bar text (top of storefront — leave blank to hide)">
          <input className="input" value={settings.store?.promoText ?? ''} onChange={(e) => upd('store', 'promoText', e.target.value)} placeholder="Free delivery on orders above Rs. 3,000" />
        </Field>
        <Field label="Storefront theme">
          <ThemePicker
            theme={settings.store?.theme ?? DEFAULT_THEME}
            customTheme={settings.store?.customTheme}
            onChange={(patch) => setSettings((s) => ({ ...s, store: { ...s.store, ...patch } }))}
          />
        </Field>
      </Section>

      {/* Shipping */}
      <Section title="Shipping" onSave={() => save('shipping')} saved={saved === 'shipping'}>
        <Field label="Flat rate (PKR)">
          <input type="number" className="input" value={settings.shipping?.flatRate ?? 0} onChange={(e) => upd('shipping', 'flatRate', Number(e.target.value))} />
        </Field>
        <Field label="Free shipping threshold (PKR)">
          <input type="number" className="input" value={settings.shipping?.freeShippingThreshold ?? 0} onChange={(e) => upd('shipping', 'freeShippingThreshold', Number(e.target.value))} />
        </Field>
      </Section>

      {/* Payments */}
      <Section title="Payment Methods" onSave={() => save('payments')} saved={saved === 'payments'}>
        {['cod', 'stripe', 'jazzcash', 'easypaisa'].map((m) => (
          <label key={m} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!settings.payments?.[m]} onChange={(e) => upd('payments', m, e.target.checked)} />
            <span className="capitalize">{m === 'cod' ? 'Cash on Delivery' : m}</span>
          </label>
        ))}
        <Field label="COD max value (PKR, 0 = no limit)">
          <input type="number" className="input" value={settings.payments?.codMaxValue ?? 0} onChange={(e) => upd('payments', 'codMaxValue', Number(e.target.value))} />
        </Field>
      </Section>

      {/* WhatsApp — a plain wa.me link, so there's no API, approval or cost. */}
      <Section title="WhatsApp Chat Button" onSave={() => save('whatsapp')} saved={saved === 'whatsapp'}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!settings.whatsapp?.enabled}
            onChange={(e) => upd('whatsapp', 'enabled', e.target.checked)}
          />
          Show the floating WhatsApp button on the storefront
        </label>
        <Field label="WhatsApp number (with country code)">
          <input
            className="input"
            placeholder="923001234567"
            value={settings.whatsapp?.phone ?? ''}
            onChange={(e) => upd('whatsapp', 'phone', e.target.value)}
          />
          <p className="mt-1 text-xs text-stone-400">
            Country code, no “+”, no spaces or dashes — e.g. 923001234567 for 0300 1234567.
            The button stays hidden until this is filled in.
          </p>
        </Field>
        <Field label="Pre-filled message">
          <input
            className="input"
            placeholder="Hi Aabroo! I have a question."
            value={settings.whatsapp?.greeting ?? ''}
            onChange={(e) => upd('whatsapp', 'greeting', e.target.value)}
          />
          <p className="mt-1 text-xs text-stone-400">
            What the customer’s message box is pre-filled with. On a product page the product
            name is appended automatically, so you can see what they were looking at.
          </p>
        </Field>
      </Section>
    </div>
  );
}

function Section({ title, children, onSave, saved }: { title: string; children: React.ReactNode; onSave: () => void; saved: boolean }) {
  return (
    <div className="card mb-6 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <button onClick={onSave} className="btn-primary text-xs">{saved ? 'Saved ✓' : 'Save'}</button>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
