import { useEffect, useState } from 'react';
import { DEFAULT_THEME, SOCIAL_NETWORKS } from '@store/shared-types';
import { api } from '@/lib/api';
import { Select } from '@/components/Select';
import { ThemePicker } from '@/components/ThemePicker';

export function Settings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const load = () => api.get<{ settings: Record<string, any> }>('/admin/settings').then((d) => setSettings(d.settings));
  useEffect(() => { load(); }, []);

  /* Courier connection state: whether the server has a token, plus the pickup
     addresses PostEx knows about so the code can be picked instead of typed. */
  const [courierState, setCourierState] = useState<{
    configured: boolean;
    addresses: { code: string; label: string }[];
    error: string | null;
  } | null>(null);
  useEffect(() => {
    api
      .get<{ configured: boolean; addresses: { code: string; label: string }[]; error: string | null }>(
        '/admin/orders/courier/config',
      )
      .then((d) => setCourierState({ configured: d.configured, addresses: d.addresses ?? [], error: d.error }))
      .catch(() => {});
  }, []);

  const save = async (key: string) => {
    await api.put(`/admin/settings/${key}`, { value: settings[key] });
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  };

  const upd = (key: string, field: string, value: unknown) =>
    setSettings((s) => ({ ...s, [key]: { ...s[key], [field]: value } }));

  /* Social rows are `{ url, enabled }` per network, so they patch one level
     deeper than the flat fields above. */
  const updSocial = (id: string, patch: { url?: string; enabled?: boolean }) =>
    setSettings((s) => ({
      ...s,
      social: { ...s.social, [id]: { ...s.social?.[id], ...patch } },
    }));

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

      {/* Reviews — anyone can post one, so this decides what goes live unseen. */}
      <Section title="Reviews" onSave={() => save('reviews')} saved={saved === 'reviews'}>
        <Field label="Publish new reviews">
          <select
            className="input"
            value={settings.reviews?.autoApprove ?? 'verified'}
            onChange={(e) => upd('reviews', 'autoApprove', e.target.value)}
          >
            <option value="verified">Only from customers who received the product</option>
            <option value="all">Immediately, from anyone</option>
            <option value="none">Never — I approve every review myself</option>
          </select>
          <p className="mt-1 text-xs text-stone-400">
            Anyone can write a review, with or without an account. This controls which ones
            appear on the storefront without you seeing them first. Held reviews wait under
            Reviews → Pending, and never affect a product’s star rating until approved.
          </p>
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

      {/* Courier — PostEx. The API token stays in the server environment; only the
          operational choices live here. */}
      <Section title="Courier (PostEx)" onSave={() => save('courier')} saved={saved === 'courier'}>
        <p className="-mt-1 text-xs text-stone-400">
          Book parcels straight from an order and send customers a tracking number. The API token is set
          on the server as <code>POSTEX_API_TOKEN</code>; everything else is here.
          {courierState && (
            <span className={courierState.configured ? 'text-green-700' : 'text-amber-700'}>
              {' '}
              {courierState.configured ? 'Token detected ✓' : 'No token on the server yet.'}
            </span>
          )}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!settings.courier?.enabled}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                courier: { ...s.courier, enabled: e.target.checked, provider: 'postex' },
              }))
            }
          />
          Use PostEx for shipments (shows the courier panel on every order)
        </label>

        <Field label="Pickup address code">
          {courierState?.addresses?.length ? (
            <Select
              value={settings.courier?.pickupAddressCode ?? ''}
              onChange={(v) => upd('courier', 'pickupAddressCode', v)}
              options={[
                { value: '', label: '— Select a pickup address —' },
                ...courierState.addresses.map((a) => ({ value: a.code, label: `${a.code} — ${a.label}` })),
              ]}
            />
          ) : (
            <input
              className="input"
              placeholder="001"
              value={settings.courier?.pickupAddressCode ?? ''}
              onChange={(e) => upd('courier', 'pickupAddressCode', e.target.value)}
            />
          )}
          <p className="mt-1 text-xs text-stone-400">
            From your PostEx merchant portal — parcels are collected from this address.
            {courierState?.error && <span className="text-amber-700"> {courierState.error}</span>}
          </p>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Order type">
            <input
              className="input"
              placeholder="Normal"
              value={settings.courier?.orderType ?? ''}
              onChange={(e) => upd('courier', 'orderType', e.target.value)}
            />
          </Field>
          <Field label="Store address code (optional)">
            <input
              className="input"
              value={settings.courier?.storeAddressCode ?? ''}
              onChange={(e) => upd('courier', 'storeAddressCode', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Customer tracking link">
          <input
            className="input"
            placeholder="https://postex.pk/tracking"
            value={settings.courier?.trackingUrlTemplate ?? ''}
            onChange={(e) => upd('courier', 'trackingUrlTemplate', e.target.value)}
          />
          <p className="mt-1 text-xs text-stone-400">
            Put <code>{'{cn}'}</code> where the tracking number goes, e.g.{' '}
            <code>https://postex.pk/tracking?cn={'{cn}'}</code>. Without it the customer gets the plain
            tracking page plus their number to paste.
          </p>
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!settings.courier?.autoBookOnConfirm}
            onChange={(e) => upd('courier', 'autoBookOnConfirm', e.target.checked)}
          />
          Book automatically when an order is marked Confirmed
        </label>
      </Section>

      {/* Social links — drive the footer icons. Each row is independently
          switchable, so a network can be kept on file without being shown. */}
      <Section title="Social Links" onSave={() => save('social')} saved={saved === 'social'}>
        <p className="-mt-1 text-xs text-stone-400">
          Fill in the accounts you use and tick “Show” for the ones that should appear in the
          storefront footer. Unticked or empty ones are hidden — no icon is rendered.
        </p>
        <div className="space-y-3">
          {SOCIAL_NETWORKS.map((n) => {
            const row = settings.social?.[n.id] ?? {};
            const needsUrl = !!row.enabled && !row.url?.trim();
            return (
              <div key={n.id}>
                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                  <span className="w-28 shrink-0 text-sm font-medium">{n.label}</span>
                  <input
                    className={`input min-w-0 flex-1 ${needsUrl ? 'border-amber-400' : ''}`}
                    placeholder={n.hint}
                    value={row.url ?? ''}
                    onChange={(e) => updSocial(n.id, { url: e.target.value })}
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-sm text-stone-600">
                    <input
                      type="checkbox"
                      checked={!!row.enabled}
                      onChange={(e) => updSocial(n.id, { enabled: e.target.checked })}
                    />
                    Show
                  </label>
                </div>
                {/* Ticked with an empty URL renders no icon — say so rather than
                    leaving the admin wondering where it went. */}
                {needsUrl && (
                  <p className="mt-1 text-xs text-amber-600 sm:ml-[7.75rem]">
                    Add a link, or untick “Show” — an empty one stays hidden.
                  </p>
                )}
              </div>
            );
          })}
        </div>
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
