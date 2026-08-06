import type { NextFunction, Request, Response } from 'express';
import { prisma } from '@store/database';

/**
 * Audit trail for the admin panel.
 *
 * Records every *successful* admin write — who, what, when, and the request
 * body. It hangs off `res.on('finish')` so a request that 4xx'd or threw never
 * produces a row: the log should say what actually changed, not what was tried.
 *
 * This is middleware rather than a call inside each handler because the only
 * audit log worth having is one that can't be forgotten. A new route is covered
 * the moment it's mounted; there is nothing to remember to add.
 *
 * Routes that know something the request body doesn't — the email of a user
 * about to be deleted, say — can enrich their row with `auditMeta()` below.
 */

/** Path segments that read as a collection, mapped to the singular entity name. */
const ENTITY_NAMES: Record<string, string> = {
  products: 'Product',
  categories: 'Category',
  attributes: 'Attribute',
  orders: 'Order',
  coupons: 'Coupon',
  sections: 'HomepageSection',
  banners: 'Banner',
  reviews: 'Review',
  settings: 'Setting',
  pages: 'StaticPage',
  users: 'User',
  uploads: 'Upload',
  email: 'EmailTemplate',
  diagnostics: 'Diagnostics',
  // Purging old entries is itself an auditable act, so it lands here too.
  activity: 'ActivityLog',
};

const ACTIONS: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/** Anything whose name suggests a credential is replaced, never stored. */
const SECRET_KEY = /pass|token|secret|apikey|api_key|otp|authorization|credential/i;

/** Long values (an email template's HTML, a base64 image) are truncated. */
const MAX_STRING = 300;
const MAX_META_CHARS = 4000;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '…';
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}… (${value.length} chars)` : value;
  }
  if (Array.isArray(value)) {
    // Long arrays (bulk reorder payloads) only need their shape recorded.
    if (value.length > 20) return `[${value.length} items]`;
    return value.map((v) => redact(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRET_KEY.test(k) ? '[redacted]' : redact(v, depth + 1),
      ]),
    );
  }
  return value;
}

/**
 * Add route-specific context to this request's audit row.
 *
 * Use it where the body alone loses the thread — a DELETE carries no body, so
 * without this the row records only an id that no longer resolves to anything.
 */
export function auditMeta(res: Response, extra: Record<string, unknown>) {
  res.locals.auditMeta = { ...(res.locals.auditMeta ?? {}), ...extra };
}

export function auditLog(req: Request, res: Response, next: NextFunction) {
  const action = ACTIONS[req.method];
  if (!action) return next(); // GET/HEAD/OPTIONS change nothing.

  // Snapshot both of these NOW, synchronously.
  //
  // req.body because handlers are free to mutate it. req.path because Express
  // rewrites it as the request descends into sub-routers — by the time `finish`
  // fires, "/users/abc123" has become "/abc123" and the entity is unrecoverable.
  const body = redact(req.body);
  const [collection, ...rest] = req.path.split('/').filter(Boolean);
  const entity = ENTITY_NAMES[collection ?? ''] ?? collection ?? 'Unknown';
  const pathId = rest.length ? rest.join('/') : null;

  // A create has no id in its URL, but the handler echoes the new row back as
  // {product: {...}} / {user: {...}}. Lift the id out so the log points at
  // something, rather than recording an anonymous "a product was created".
  let createdId: string | null = null;
  if (!pathId) {
    const json = res.json.bind(res);
    res.json = (payload: unknown) => {
      const first = payload && typeof payload === 'object' ? Object.values(payload)[0] : null;
      if (first && typeof first === 'object' && typeof (first as { id?: unknown }).id === 'string') {
        createdId = (first as { id: string }).id;
      }
      return json(payload);
    };
  }

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const adminId = req.auth?.userId;
    if (!adminId) return; // Unauthenticated writes never reach here, but don't guess.

    const entityId = pathId ?? createdId;
    let meta: unknown = { ...(res.locals.auditMeta ?? {}), body };
    // A pathological payload shouldn't be able to bloat the audit table.
    if (JSON.stringify(meta).length > MAX_META_CHARS) {
      meta = { ...(res.locals.auditMeta ?? {}), body: '[too large to record]' };
    }

    // Fire-and-forget: an audit write must never fail the request the user
    // already got a 200 for, but a silent failure would be worse than noisy.
    //
    // The actor's name/email are copied onto the row so the entry stays
    // readable after that account is deleted — see the model's comment.
    prisma.user
      .findUnique({ where: { id: adminId }, select: { name: true, email: true } })
      .then((actor) =>
        prisma.adminActivityLog.create({
          data: {
            adminId,
            adminName: actor?.name ?? 'Unknown',
            adminEmail: actor?.email ?? '',
            action,
            entity,
            entityId,
            meta: meta as never,
          },
        }),
      )
      .catch((err) => console.error('[audit] failed to record admin action:', err));
  });

  next();
}
