import { createHash } from 'node:crypto';
import { Prisma } from '@store/database';
import { toNum } from './money';

/** Money as it arrives from Prisma (Decimal) or already-serialised (number). */
type Money = Prisma.Decimal | number | null | undefined;

/**
 * Meta Conversions API (server-side Purchase reporting).
 *
 * Why this exists alongside the browser Pixel: the Pixel is blocked by
 * ad-blockers, Safari/iOS tracking prevention, and any network-level filtering —
 * commonly a double-digit share of sessions. Those are real sales that Meta
 * never learns about, so its ad optimisation is trained on incomplete data and
 * reported ROAS is understated.
 *
 * Sending the same purchase from the server closes that gap. Both events carry
 * the SAME `event_id` (`purchase_<orderId>`), which is how Meta deduplicates
 * them — see purchaseEventId() in apps/storefront/src/lib/analytics.ts. If those
 * two ever diverge, every online sale is counted twice.
 *
 * Best-effort by design: never throws, never blocks order placement.
 */

const PIXEL_ID = process.env.META_PIXEL_ID ?? '';
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN ?? '';
// Optional: set while validating in Events Manager → Test Events, then remove.
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE ?? '';
const GRAPH_VERSION = 'v21.0';

export const CAPI_ENABLED = Boolean(PIXEL_ID && ACCESS_TOKEN);

// Meta requires PII to be SHA-256 hashed after normalisation (trimmed,
// lowercased). Raw email/phone must never leave this process.
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const hashEmail = (email?: string | null) =>
  email ? sha256(email.trim().toLowerCase()) : undefined;

// Phone numbers must be digits-only in E.164 order, no '+' and no separators.
function hashPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return undefined;
  const e164 = digits.startsWith('92')
    ? digits
    : digits.startsWith('0')
      ? `92${digits.slice(1)}`
      : digits.startsWith('3')
        ? `92${digits}`
        : digits;
  return sha256(e164);
}

const hashName = (name?: string | null) =>
  name ? sha256(name.trim().toLowerCase()) : undefined;

/** Browser signals that materially improve match quality when forwarded. */
export interface CapiContext {
  clientIp?: string;
  userAgent?: string;
  /** _fbp cookie — Meta's own browser id. The single strongest match signal. */
  fbp?: string;
  /** _fbc cookie / fbclid — ties the sale to the exact ad click. */
  fbc?: string;
  eventSourceUrl?: string;
}

interface OrderLike {
  id: string;
  orderNumber: string;
  total: Money;
  shipping?: Money;
  tax?: Money;
  couponCode?: string | null;
  items: {
    quantity: number;
    price: Money;
    variantId: string;
    variant?: { productId: string } | null;
  }[];
}

interface BuyerLike {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
}

export async function sendPurchaseToMeta(
  order: OrderLike,
  buyer: BuyerLike,
  ctx: CapiContext = {},
): Promise<void> {
  if (!CAPI_ENABLED) return;

  try {
    const contents = order.items.map((it) => ({
      // Product id, not variant id — must match the Pixel and the catalogue feed.
      id: it.variant?.productId ?? it.variantId,
      quantity: it.quantity,
      item_price: toNum(it.price),
    }));

    const event = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      // Shared dedup key with the browser Pixel.
      event_id: `purchase_${order.id}`,
      action_source: 'website',
      event_source_url: ctx.eventSourceUrl,
      user_data: {
        em: hashEmail(buyer.email) ? [hashEmail(buyer.email)] : undefined,
        ph: hashPhone(buyer.phone) ? [hashPhone(buyer.phone)] : undefined,
        fn: hashName(buyer.name?.split(' ')[0]) ? [hashName(buyer.name?.split(' ')[0])] : undefined,
        ct: hashName(buyer.city) ? [hashName(buyer.city)] : undefined,
        country: [sha256('pk')],
        client_ip_address: ctx.clientIp,
        client_user_agent: ctx.userAgent,
        fbp: ctx.fbp,
        fbc: ctx.fbc,
      },
      custom_data: {
        currency: 'PKR',
        value: toNum(order.total),
        content_type: 'product',
        content_ids: contents.map((c) => c.id),
        contents,
        num_items: order.items.reduce((s, i) => s + i.quantity, 0),
        order_id: order.orderNumber,
        shipping: order.shipping != null ? toNum(order.shipping) : undefined,
        tax: order.tax != null ? toNum(order.tax) : undefined,
        ...(order.couponCode ? { coupon: order.couponCode } : {}),
      },
    };

    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [event],
        access_token: ACCESS_TOKEN,
        ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
      }),
      // Never let a slow Graph API call hold an HTTP response open.
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[meta-capi] Purchase ${order.orderNumber} rejected (${res.status}): ${body.slice(0, 300)}`);
      return;
    }
    console.log(`[meta-capi] Purchase ${order.orderNumber} sent`);
  } catch (err) {
    console.error('[meta-capi] send failed:', (err as Error).message);
  }
}

/** Pulls Meta's attribution cookies + client hints off the incoming request. */
export function capiContextFromRequest(req: {
  ip?: string;
  headers: Record<string, unknown>;
  cookies?: Record<string, string>;
  body?: Record<string, unknown>;
}): CapiContext {
  const header = (k: string) => {
    const v = req.headers[k];
    return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;
  };
  // The storefront is a separate origin, so Meta's cookies aren't sent to the
  // API automatically — the checkout request forwards them in its body.
  const fromBody = (k: string) => {
    const v = req.body?.[k];
    return typeof v === 'string' && v ? v : undefined;
  };
  return {
    clientIp: header('x-forwarded-for')?.split(',')[0].trim() ?? req.ip,
    userAgent: header('user-agent'),
    fbp: fromBody('fbp') ?? req.cookies?._fbp,
    fbc: fromBody('fbc') ?? req.cookies?._fbc,
    eventSourceUrl: fromBody('eventSourceUrl') ?? header('referer'),
  };
}
