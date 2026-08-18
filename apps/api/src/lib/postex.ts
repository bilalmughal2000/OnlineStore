import { prisma } from '@store/database';
import { ApiError, badRequest } from './errors';

/*
 * PostEx (Pakistan) courier integration.
 *
 * Merchant API, base https://api.postex.pk/services/integration/api/order.
 * Auth is a single `token` header — no OAuth, no signing.
 *
 * The token is read from the environment, not from the settings table: it is a
 * credential, and the rest of this codebase keeps credentials in env for the
 * same reason (see WhatsApp). Everything non-secret — pickup address, order
 * type, whether booking is automatic — is admin-editable in Settings.
 *
 * Nothing here throws on a missing token; `configured()` is false and the admin
 * screens say so, exactly like the WhatsApp button staying hidden until a number
 * is set.
 */

const DEFAULT_BASE = 'https://api.postex.pk/services/integration/api/order';

export interface CourierSettings {
  provider: string; // '' | 'postex'
  enabled: boolean;
  pickupAddressCode: string;
  storeAddressCode: string;
  orderType: string;
  /** Book the parcel automatically when an order is marked CONFIRMED. */
  autoBookOnConfirm: boolean;
  /** Customer-facing tracking link. `{cn}` is replaced with the tracking number. */
  trackingUrlTemplate: string;
}

const DEFAULTS: CourierSettings = {
  provider: '',
  enabled: false,
  pickupAddressCode: '',
  storeAddressCode: '',
  orderType: 'Normal',
  autoBookOnConfirm: false,
  trackingUrlTemplate: 'https://postex.pk/tracking',
};

export async function courierSettings(): Promise<CourierSettings> {
  const row = await prisma.setting.findUnique({ where: { key: 'courier' } });
  const v = (row?.value ?? {}) as Partial<CourierSettings>;
  return { ...DEFAULTS, ...v };
}

const token = () => process.env.POSTEX_API_TOKEN ?? '';
const baseUrl = () => process.env.POSTEX_BASE_URL ?? DEFAULT_BASE;

/** True when a token is present — i.e. the integration can actually be used. */
export function postexConfigured(): boolean {
  return Boolean(token());
}

/*
 * A PostEx-reported (or unreachable-PostEx) failure.
 *
 * An ApiError subclass so the message reaches the admin instead of being
 * flattened to "Something went wrong": when a booking fails, *why* is the whole
 * story — unserviced city, bad pickup code, courier down. 502, because the
 * failure is upstream rather than in the request.
 */
export class CourierError extends ApiError {
  constructor(message: string) {
    super(502, message, 'COURIER_ERROR');
  }
}

interface PostexEnvelope {
  statusCode?: string | number;
  statusMessage?: string;
  dist?: Record<string, unknown> | Record<string, unknown>[];
}

async function call<T = PostexEnvelope>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  if (!postexConfigured()) throw badRequest('PostEx API token is not set on the server (POSTEX_API_TOKEN)');

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        // PostEx identifies the merchant by this header, not Authorization.
        token: token(),
        'Content-Type': 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      // A courier being slow must not hang an admin request forever.
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new CourierError(`Could not reach PostEx: ${(err as Error).message}`);
  }

  const text = await res.text();
  let body: PostexEnvelope | undefined;
  try {
    body = text ? (JSON.parse(text) as PostexEnvelope) : undefined;
  } catch {
    /* non-JSON error page */
  }

  // PostEx answers 200 with its own statusCode, so both layers need checking.
  const code = String(body?.statusCode ?? res.status);
  if (!res.ok || (code !== '200' && code !== '0')) {
    const message = body?.statusMessage || text.slice(0, 300) || `HTTP ${res.status}`;
    throw new CourierError(`PostEx: ${message}`);
  }
  return (body ?? {}) as T;
}

/** Digits-only local format — PostEx expects a Pakistani mobile number. */
function normalisePhone(phone: string | null | undefined): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('92')) return `0${digits.slice(2)}`;
  if (digits.startsWith('0')) return digits;
  return digits ? `0${digits}` : '';
}

export interface BookableOrder {
  orderNumber: string;
  total: unknown; // Prisma Decimal
  paymentMethod: string;
  paymentStatus: string;
  notes?: string | null;
  items: { productTitle: string; variantLabel?: string | null; quantity: number }[];
  address?: {
    fullName: string;
    phone: string;
    addressLine: string;
    city: string;
  } | null;
}

export interface BookedShipment {
  trackingNumber: string;
  status?: string;
  raw: unknown;
}

/**
 * Book a parcel. Amount to collect is the order total for COD and zero once the
 * order is already paid — sending the total on a prepaid order would have the
 * rider ask for money twice.
 */
export async function bookShipment(order: BookableOrder, cfg: CourierSettings): Promise<BookedShipment> {
  if (!order.address) throw badRequest('This order has no shipping address');
  if (!cfg.pickupAddressCode) throw badRequest('Set a PostEx pickup address code in Settings first');

  const collect =
    order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID' ? Number(order.total) : 0;
  const pieces = order.items.reduce((n, i) => n + i.quantity, 0);
  const contents = order.items
    .map((i) => `${i.productTitle}${i.variantLabel ? ` (${i.variantLabel})` : ''} x${i.quantity}`)
    .join(', ')
    .slice(0, 250);

  const payload = {
    cityName: order.address.city,
    customerName: order.address.fullName,
    customerPhone: normalisePhone(order.address.phone),
    deliveryAddress: order.address.addressLine,
    invoiceDivision: 1,
    invoicePayment: collect,
    items: pieces || 1,
    orderDetail: contents || order.orderNumber,
    orderRefNumber: order.orderNumber,
    orderType: cfg.orderType || 'Normal',
    transactionNotes: (order.notes ?? '').slice(0, 250),
    pickupAddressCode: cfg.pickupAddressCode,
    ...(cfg.storeAddressCode ? { storeAddressCode: cfg.storeAddressCode } : {}),
  };

  const body = await call('/v3/create-order', { method: 'POST', body: payload });
  const dist = (Array.isArray(body.dist) ? body.dist[0] : body.dist) ?? {};
  // Field naming has shifted between PostEx API versions, so accept the known aliases.
  const trackingNumber = String(
    dist.trackingNumber ?? dist.trackingNo ?? dist.cn ?? dist.orderTrackingNumber ?? '',
  );
  if (!trackingNumber) {
    throw new CourierError('PostEx accepted the order but returned no tracking number');
  }
  return { trackingNumber, status: dist.orderStatus ? String(dist.orderStatus) : undefined, raw: body };
}

export interface ShipmentStatus {
  status?: string;
  history: { status: string; at?: string }[];
  raw: unknown;
}

export async function trackShipment(trackingNumber: string): Promise<ShipmentStatus> {
  const body = await call(`/v1/track-order/${encodeURIComponent(trackingNumber)}`);
  const dist = (Array.isArray(body.dist) ? body.dist[0] : body.dist) ?? {};
  const rawHistory = (dist.transactionStatusHistory ?? dist.statusHistory ?? []) as Record<
    string,
    unknown
  >[];
  const history = (Array.isArray(rawHistory) ? rawHistory : []).map((h) => ({
    status: String(h.transactionStatusMessage ?? h.status ?? ''),
    at: h.updatedAt ? String(h.updatedAt) : h.transactionStatusMessageCode ? undefined : undefined,
  }));
  const status = String(
    dist.transactionStatus ?? dist.orderStatus ?? history.at(-1)?.status ?? '',
  );
  return { status: status || undefined, history, raw: body };
}

export async function cancelShipment(trackingNumber: string): Promise<void> {
  await call('/v1/cancel-order', { method: 'PUT', body: { trackingNumber } });
}

/** Cities PostEx delivers to — used to sanity-check an order's city in admin. */
export async function operationalCities(): Promise<string[]> {
  const body = await call('/v2/get-operational-city');
  const rows = (Array.isArray(body.dist) ? body.dist : []) as Record<string, unknown>[];
  return rows.map((r) => String(r.operationalCityName ?? r.cityName ?? '')).filter(Boolean);
}

/** The merchant's registered pickup locations, so the code can be picked not typed. */
export async function pickupAddresses(): Promise<{ code: string; label: string }[]> {
  const body = await call('/v1/get-merchant-address');
  const rows = (Array.isArray(body.dist) ? body.dist : []) as Record<string, unknown>[];
  return rows.map((r) => ({
    code: String(r.addressCode ?? r.pickupAddressCode ?? ''),
    label: [r.address, r.cityName].filter(Boolean).join(', ') || String(r.addressCode ?? ''),
  }));
}

/** Customer-facing tracking link for a booked parcel. */
export function trackingUrl(cfg: CourierSettings, trackingNumber: string): string {
  const t = cfg.trackingUrlTemplate || DEFAULTS.trackingUrlTemplate;
  return t.includes('{cn}') ? t.replace('{cn}', encodeURIComponent(trackingNumber)) : t;
}
