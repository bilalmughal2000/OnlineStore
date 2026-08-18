'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Truck } from 'lucide-react';
import { clientApi } from '@/lib/client-api';

/*
 * Tracking details for a booked parcel.
 *
 * The tracking-number-and-courier pair is the single thing customers come back
 * to an order page for, so it gets its own block rather than a line of small
 * print. The link shape is admin-configurable (couriers change their tracking
 * URLs), and when no `{cn}` placeholder is configured the number is shown to
 * copy and paste instead of building a link that would 404.
 */

const COURIER_LABELS: Record<string, string> = { postex: 'PostEx' };
const DEFAULT_TEMPLATE = 'https://postex.pk/tracking';

export function TrackParcel({
  courier,
  trackingNumber,
  courierStatus,
  compact = false,
}: {
  courier?: string | null;
  trackingNumber?: string | null;
  courierStatus?: string | null;
  compact?: boolean;
}) {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!trackingNumber) return;
    clientApi
      .get<{ settings: { courier?: { trackingUrlTemplate?: string } } }>('/content/settings')
      .then((d) => setTemplate(d.settings?.courier?.trackingUrlTemplate || DEFAULT_TEMPLATE))
      .catch(() => {});
  }, [trackingNumber]);

  if (!trackingNumber) return null;

  const label = COURIER_LABELS[courier ?? ''] ?? courier ?? 'Courier';
  const hasDeepLink = template.includes('{cn}');
  const href = hasDeepLink ? template.replace('{cn}', encodeURIComponent(trackingNumber)) : template;

  const copy = () => {
    navigator.clipboard?.writeText(trackingNumber).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink/60">
        <Truck size={13} className="text-accent" />
        {label}
        <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
          {trackingNumber}
        </a>
      </span>
    );
  }

  return (
    <div className="card mt-6 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-black/5 bg-accent/[0.06] px-5 py-3">
        <Truck size={16} className="text-accent" />
        <h2 className="text-sm font-semibold">Your parcel is on the way</h2>
        {courierStatus && (
          <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-ink/60">
            {courierStatus}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink/40">{label} tracking number</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded-lg bg-black/[0.04] px-2.5 py-1.5 text-sm font-semibold tracking-wide">
              {trackingNumber}
            </code>
            <button
              onClick={copy}
              aria-label="Copy tracking number"
              className="rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-black/5 hover:text-ink"
            >
              {copied ? <Check size={15} className="text-accent" /> : <Copy size={15} />}
            </button>
          </div>
          {!hasDeepLink && (
            <p className="mt-1.5 text-xs text-ink/45">Paste this number on the tracking page.</p>
          )}
        </div>
        <a href={href} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
          Track parcel
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
