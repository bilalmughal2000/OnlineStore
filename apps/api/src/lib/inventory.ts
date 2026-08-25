import { prisma } from '@store/database';
import { renderEmail } from './email/render';
import { sendEmail } from './notify';

/**
 * Low-stock alerting.
 *
 * The dashboard has always shown a low-stock count, but only to whoever
 * happened to look at it. This tells you instead — the point of an alert is
 * that it reaches you when you aren't watching.
 *
 * Alerts fire on the *crossing*, not on the level: an item that is merely
 * still-low doesn't re-send on every subsequent order. That keeps this
 * stateless — no "already notified" column to set, clear and get out of sync —
 * because the transition is derivable from the quantity just sold:
 *
 *     before = after + quantitySold
 *
 * Restocking re-arms it automatically: stock goes back above the threshold, so
 * the next sale that takes it under crosses again.
 */

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export interface InventorySettings {
  threshold: number;
  alertsEnabled: boolean;
  /** Explicit recipient; falls back to the first ADMIN account. */
  alertEmail: string;
}

export async function getInventorySettings(): Promise<InventorySettings> {
  const row = await prisma.setting.findUnique({ where: { key: 'inventory' } }).catch(() => null);
  const v = (row?.value ?? {}) as Record<string, unknown>;
  const threshold = Number(v.lowStockThreshold);
  return {
    threshold: Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_LOW_STOCK_THRESHOLD,
    // Default ON: an alert nobody switched on is an alert nobody gets.
    alertsEnabled: v.alertsEnabled === undefined ? true : Boolean(v.alertsEnabled),
    alertEmail: typeof v.alertEmail === 'string' ? v.alertEmail.trim() : '',
  };
}

/** Where the alert goes: the configured address, else the first admin account. */
async function resolveRecipient(configured: string): Promise<string | null> {
  if (configured) return configured;
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { email: true },
  });
  return admin?.email ?? null;
}

interface SoldLine {
  variantId: string;
  quantity: number;
}

interface CrossedItem {
  label: string;
  remaining: number;
}

function itemsTable(items: CrossedItem[]): string {
  const rows = items
    .map((it, i) => {
      const last = i === items.length - 1;
      const border = last ? '' : 'border-bottom:1px solid #e7e5e4;';
      const right =
        it.remaining === 0
          ? '<span style="color:#dc2626">Sold out</span>'
          : `<span style="color:#b45309">${it.remaining} left</span>`;
      return (
        `<tr><td style="padding:10px 0;${border}color:#1c1917">${escapeHtml(it.label)}</td>` +
        `<td align="right" style="padding:10px 0;${border}font-weight:700">${right}</td></tr>`
      );
    })
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:8px">${rows}</table>`;
}

/** Product titles are admin-supplied, and this lands in an HTML email. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Checks the variants an order just consumed and emails if any crossed the
 * low-stock line or sold out.
 *
 * Fire-and-forget by design: this runs after checkout has already succeeded, so
 * a mail problem must never surface to the shopper or undo their order.
 */
export function notifyLowStock(sold: SoldLine[]): void {
  if (sold.length === 0) return;

  void (async () => {
    try {
      const { threshold, alertsEnabled, alertEmail } = await getInventorySettings();
      if (!alertsEnabled) return;

      const variants = await prisma.productVariant.findMany({
        where: { id: { in: sold.map((s) => s.variantId) } },
        select: {
          id: true,
          stock: true,
          size: true,
          color: true,
          product: { select: { title: true } },
        },
      });

      const soldQty = new Map(sold.map((s) => [s.variantId, s.quantity]));
      const crossed: CrossedItem[] = [];

      for (const v of variants) {
        const qty = soldQty.get(v.id) ?? 0;
        const after = v.stock;
        const before = after + qty;

        // Two transitions are worth interrupting someone for: dropping under
        // the threshold, and running out entirely. The second matters on its
        // own because an item already below the line still sells its last unit
        // without ever crossing the threshold again.
        const crossedThreshold = after <= threshold && before > threshold;
        const justSoldOut = after === 0 && before > 0;
        if (!crossedThreshold && !justSoldOut) continue;

        crossed.push({
          label: [v.product.title, [v.size, v.color].filter(Boolean).join(' / ')]
            .filter(Boolean)
            .join(' — '),
          remaining: after,
        });
      }

      if (crossed.length === 0) return;

      const to = await resolveRecipient(alertEmail);
      if (!to) {
        console.warn('[inventory] low-stock alert skipped — no recipient configured and no ADMIN user');
        return;
      }

      // Sort the urgent ones first: sold out, then fewest remaining.
      crossed.sort((a, b) => a.remaining - b.remaining);
      const anySoldOut = crossed.some((c) => c.remaining === 0);
      const adminUrl = (process.env.ADMIN_URL ?? '').replace(/\/$/, '');

      const { subject, html } = await renderEmail(
        'LOW_STOCK',
        {
          alertTitle: anySoldOut ? 'Sold out' : 'Running low',
          itemCount: String(crossed.length),
          itemsTable: itemsTable(crossed),
        },
        { cta: adminUrl ? { label: 'Open products', url: `${adminUrl}/products` } : null },
      );
      await sendEmail(to, subject, html);
    } catch (err) {
      console.error('[inventory] low-stock alert failed:', (err as Error).message);
    }
  })();
}
