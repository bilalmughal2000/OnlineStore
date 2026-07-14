import { Check, Palette } from 'lucide-react';
import { THEMES, DEFAULT_THEME, type ThemePalette } from '@store/shared-types';

const toHex = (channels?: string) => {
  if (!channels) return '#000000';
  const [r, g, b] = channels.trim().split(/\s+/).map(Number);
  return '#' + [r, g, b].map((n) => (n || 0).toString(16).padStart(2, '0')).join('');
};
const toChannels = (hex: string) => {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
};

const FIELDS: { key: keyof ThemePalette; label: string }[] = [
  { key: 'accent', label: 'Primary (buttons)' },
  { key: 'accentDark', label: 'Primary hover' },
  { key: 'accentLight', label: 'Highlight' },
  { key: 'ink', label: 'Text' },
  { key: 'cream', label: 'Background' },
  { key: 'sale', label: 'Sale / badges' },
];

interface Props {
  theme: string;
  customTheme?: ThemePalette;
  onChange: (patch: { theme?: string; customTheme?: ThemePalette }) => void;
}

export function ThemePicker({ theme, customTheme, onChange }: Props) {
  const activeCustom: ThemePalette =
    customTheme?.accent ? customTheme : { ...(THEMES[theme] ?? THEMES[DEFAULT_THEME]).colors };

  const pickCustom = () => onChange({ theme: 'custom', customTheme: activeCustom });
  const setColor = (key: keyof ThemePalette, hex: string) =>
    onChange({ theme: 'custom', customTheme: { ...activeCustom, [key]: toChannels(hex) } });

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(THEMES).map(([key, t]) => {
          const active = theme === key;
          return (
            <button
              type="button"
              key={key}
              onClick={() => onChange({ theme: key })}
              className={`relative rounded-lg border p-3 text-left transition ${active ? 'border-brand ring-2 ring-brand/30' : 'border-stone-200 hover:border-stone-300'}`}
            >
              {active && <Check size={14} className="absolute right-2 top-2 text-brand" />}
              <div className="mb-2 flex gap-1">
                {[t.colors.accent, t.colors.accentDark, t.colors.accentLight, t.colors.ink].map((c, i) => (
                  <span key={i} className="h-6 w-6 rounded-full ring-1 ring-black/10" style={{ background: `rgb(${c})` }} />
                ))}
              </div>
              <p className="text-sm font-medium">{t.name}</p>
            </button>
          );
        })}

        {/* Custom */}
        <button
          type="button"
          onClick={pickCustom}
          className={`relative rounded-lg border p-3 text-left transition ${theme === 'custom' ? 'border-brand ring-2 ring-brand/30' : 'border-stone-200 hover:border-stone-300'}`}
        >
          {theme === 'custom' && <Check size={14} className="absolute right-2 top-2 text-brand" />}
          <div className="mb-2 flex h-6 items-center gap-1">
            <span className="h-6 w-6 rounded-full ring-1 ring-black/10" style={{ background: 'conic-gradient(#b45309,#059669,#4f46e5,#e11d48,#0284c7,#ca8a04,#b45309)' }} />
            <Palette size={16} className="text-stone-500" />
          </div>
          <p className="text-sm font-medium">Custom</p>
        </button>
      </div>

      {theme === 'custom' && (
        <div className="mt-4 rounded-lg border border-stone-200 p-4">
          <p className="mb-3 text-sm font-medium">Custom colours</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={toHex(activeCustom[f.key])}
                  onChange={(e) => setColor(f.key, e.target.value)}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded border border-stone-300"
                />
                <span className="text-sm text-stone-600">{f.label}</span>
              </label>
            ))}
          </div>

          {/* Live preview */}
          <div className="mt-4 overflow-hidden rounded-lg border border-stone-200">
            <div className="p-4" style={{ background: `rgb(${activeCustom.cream})` }}>
              <p className="font-serif text-lg font-bold" style={{ color: `rgb(${activeCustom.ink})` }}>
                Preview heading
              </p>
              <p className="mt-0.5 text-sm" style={{ color: `rgb(${activeCustom.ink})`, opacity: 0.7 }}>
                Body text on the storefront background.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: `rgb(${activeCustom.accent})` }}>
                  Shop Now
                </span>
                <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: `rgb(${activeCustom.sale})` }}>
                  -20%
                </span>
                <span className="text-sm font-medium" style={{ color: `rgb(${activeCustom.accent})` }}>
                  Link
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-stone-400">Applies to the customer storefront. Save to publish.</p>
    </div>
  );
}
