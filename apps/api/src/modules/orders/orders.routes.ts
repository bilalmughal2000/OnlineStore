import { Router } from 'express';
import {
  prisma,
  Prisma,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@store/database';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { checkoutSchema } from '@store/shared-types';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { issueTokens, toAuthUser } from '../../lib/session';
import { authLimiter, checkoutLimiter } from '../../middleware/rateLimit';
import { badRequest, notFound } from '../../lib/errors';
import { serialize } from '../../lib/serialize';
import { notifyOrderLinks, notifyOrderPlaced } from '../../lib/notify';
import { capiContextFromRequest, sendPurchaseToMeta } from '../../lib/meta-capi';
import { priceCart } from './pricing';
import { resolveCart } from '../cart/cart.service';

export const ordersRouter = Router();
// Guests can check out and view the order they just placed, so auth is applied
// per route rather than to the whole router. Anything that lists or mutates an
// account's history still requires a real session.
ordersRouter.use(optionalAuth);

function orderNumber(seq: number): string {
  return `PK${String(Date.now()).slice(-8)}${String(seq % 1000).padStart(3, '0')}`;
}

// Capability key for a guest order. 32 random bytes — order ids travel in URLs
// and server logs, so they can't double as the secret that guards an order.
const newGuestToken = () => randomBytes(32).toString('hex');

/**
 * Ownership filter for a single order: the signed-in user's own order, or a
 * guest order whose token matches.
 *
 * Built as an explicit branch on purpose. Writing
 * `{ id, userId: req.auth?.userId }` looks equivalent but is a security hole —
 * Prisma silently DROPS keys whose value is `undefined`, so for an
 * unauthenticated caller the filter degrades to `{ id }` and matches the order
 * regardless of who owns it. The sentinel keeps the condition unsatisfiable
 * when no token is supplied, so a null `guestToken` row can never match either.
 */
function orderOwnershipWhere(req: import('express').Request): Prisma.OrderWhereInput {
  const id = req.params.id;
  const userId = req.auth?.userId;
  if (userId) return { id, userId };
  const token = typeof req.query.token === 'string' && req.query.token ? req.query.token : null;
  return { id, guestToken: token ?? '__no_token__' };
}

const orderInclude = {
  // variant.productId lets the client report analytics events keyed on the
  // product (matching view_item / add_to_cart and the Meta catalogue feed)
  // rather than on the variant, which would break conversion attribution.
  items: { include: { variant: { select: { productId: true } } } },
  address: true,
  payments: true,
  statusLogs: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

// POST /orders/checkout — place an order from the user's cart
ordersRouter.post(
  '/checkout',
  checkoutLimiter,
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth?.userId ?? null;
    const body = req.body as import('@store/shared-types').CheckoutInput;

    // Guests must leave an email — it's the only channel for the confirmation
    // and any later status update, since no account is created.
    const guestEmail = userId ? null : (body.guestEmail?.trim().toLowerCase() ?? null);
    if (!userId && !guestEmail) throw badRequest('An email address is required to place your order');

    // resolveCart handles both identities (session user or x-guest-id header).
    const cart = await resolveCart(req);
    if (cart.items.length === 0) throw badRequest('Your cart is empty');

    // Resolve shipping address.
    //
    // Guests must always send a fresh address. Accepting an `addressId` from an
    // unauthenticated caller would let them attach — and then read back, since
    // the order response embeds the address — any other guest's address.
    // Guests have no saved addresses, so there is nothing legitimate to allow.
    let addressId: string | undefined;
    if (userId) {
      addressId = body.addressId;
      if (!addressId && body.newAddress) {
        const addr = await prisma.address.create({ data: { ...body.newAddress, userId } });
        addressId = addr.id;
      }
      if (!addressId) throw badRequest('A shipping address is required');
      const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
      if (!address) throw notFound('Address not found');
    } else {
      if (!body.newAddress) throw badRequest('A shipping address is required');
      // userId stays null: the address belongs to this order, not an account.
      const addr = await prisma.address.create({ data: { ...body.newAddress, userId: null } });
      addressId = addr.id;
    }

    // Authoritative server-side pricing (never trust client totals).
    // Use the coupon persisted on the cart (falls back to the request body).
    const pricing = await priceCart(
      cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      { couponCode: cart.couponCode ?? body.couponCode, userId, guestEmail },
    );
    if (pricing.lines.length === 0) throw badRequest('Your cart is empty');

    // COD value ceiling check (fraud prevention, Section 6.1).
    if (body.paymentMethod === 'COD') {
      const paySetting = await prisma.setting.findUnique({ where: { key: 'payments' } });
      const codMax = Number((paySetting?.value as Record<string, unknown>)?.codMaxValue ?? 0);
      if (codMax > 0 && pricing.total > codMax) {
        throw badRequest(`COD is not available for orders above Rs. ${codMax}. Please pay online.`);
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      // Re-check stock and decrement atomically.
      for (const line of pricing.lines) {
        const variant = await tx.productVariant.findUnique({ where: { id: line.variantId } });
        if (!variant || variant.stock < line.quantity) {
          throw badRequest(`"${line.productTitle}" is out of stock`);
        }
      }
      for (const line of pricing.lines) {
        await tx.productVariant.update({
          where: { id: line.variantId },
          data: { stock: { decrement: line.quantity } },
        });
      }

      const count = await tx.order.count();
      const created = await tx.order.create({
        data: {
          orderNumber: orderNumber(count + 1),
          userId,
          guestEmail,
          // Only guests get a token; signed-in users are authorised by session.
          guestToken: userId ? null : newGuestToken(),
          status: OrderStatus.PLACED,
          paymentMethod: body.paymentMethod as PaymentMethod,
          paymentStatus: PaymentStatus.PENDING,
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          shipping: pricing.shipping,
          tax: pricing.tax,
          total: pricing.total,
          couponCode: pricing.couponCode,
          addressId,
          notes: body.notes,
          items: {
            create: pricing.lines.map((l) => ({
              variantId: l.variantId,
              productTitle: l.productTitle,
              variantLabel: l.variantLabel,
              price: l.unitPrice,
              quantity: l.quantity,
            })),
          },
          statusLogs: { create: { status: OrderStatus.PLACED, note: 'Order placed' } },
          payments: {
            create: {
              gateway: body.paymentMethod as PaymentMethod,
              status: PaymentStatus.PENDING,
              amount: pricing.total,
            },
          },
        },
        include: orderInclude,
      });

      if (pricing.couponCode) {
        await tx.coupon.update({
          where: { code: pricing.couponCode },
          data: { usedCount: { increment: 1 } },
        });
      }
      // Clear the cart (items + applied coupon).
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      if (cart.couponCode) await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
      return created;
    });

    // TODO(Phase 4): for STRIPE/JAZZCASH/EASYPAISA, initiate the gateway session
    // here and return a redirect/checkout URL instead of a completed order.

    // Who to contact about this order. For a guest that's the email they typed
    // plus the name/phone on the shipping address — there is no account to read.
    const buyer = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true, phone: true },
        })
      : {
          name: order.address?.fullName ?? 'Customer',
          email: guestEmail,
          phone: order.address?.phone ?? null,
        };

    // Order-confirmation notification (email + WhatsApp), best-effort.
    // Guests get a tokenised link so they can reopen the order without an account.
    if (buyer) notifyOrderPlaced(order, buyer, { guestToken: order.guestToken });

    // Server-side Purchase → Meta Conversions API. Deliberately not awaited:
    // ad reporting must never add latency to (or fail) a completed checkout.
    // Deduped against the browser Pixel via event_id — see lib/meta-capi.ts.
    if (buyer) {
      const attribution = (body as { attribution?: Record<string, string> }).attribution ?? {};
      void sendPurchaseToMeta(
        order,
        { ...buyer, city: order.address?.city ?? null },
        capiContextFromRequest({
          ip: req.ip,
          headers: req.headers as Record<string, unknown>,
          body: attribution,
        }),
      );
    }

    res.status(201).json({
      order: serialize(order),
      // The guest's capability key for this order. The client keeps it (URL +
      // sessionStorage) so the confirmation page can load without a login.
      guestToken: order.guestToken ?? undefined,
      payment:
        body.paymentMethod === 'COD'
          ? { method: 'COD', status: 'PENDING', redirectUrl: null }
          : { method: body.paymentMethod, status: 'PENDING', redirectUrl: null, note: 'Gateway integration pending (Phase 4)' },
    });
  }),
);

// POST /orders/lookup — "find my orders". Emails the tokenised links for every
// guest order placed with that address.
//
// Why by email rather than showing them on screen: receiving the email is the
// proof of ownership. Returning order data to whoever types an address would
// leak names, phones and addresses to anyone guessing emails.
//
// Always answers 200 with the same body, whether or not orders exist, so the
// endpoint can't be used to test which emails have shopped here.
ordersRouter.post(
  '/lookup',
  authLimiter,
  validate(z.object({ email: z.string().trim().max(191).email('Enter a valid email address') })),
  asyncHandler(async (req, res) => {
    const email = String(req.body.email).trim().toLowerCase();
    const orders = await prisma.order.findMany({
      where: { guestEmail: email, guestToken: { not: null } },
      select: { id: true, orderNumber: true, guestToken: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    if (orders.length > 0) notifyOrderLinks(email, orders);
    res.json({ ok: true });
  }),
);

// POST /orders/:id/claim — turn a completed guest order into an account.
//
// Offered on the confirmation page: the buyer has already given us their email,
// name, phone and address, so becoming a customer costs them one password field.
// Asking here rather than before checkout is the whole point — a signup wall in
// front of payment is what loses the sale.
//
// Authorised by the order's guestToken, exactly like GET /orders/:id. That token
// is proof they placed THIS order, which is what entitles them to adopt it.
ordersRouter.post(
  '/:id/claim',
  authLimiter,
  validate(z.object({ password: z.string().min(8, 'Password must be at least 8 characters') })),
  asyncHandler(async (req, res) => {
    // Claiming is always authorised by the guest token, never by the session.
    // orderOwnershipWhere() would take the session branch for a signed-in user
    // and filter on `userId`, which can't match an unclaimed guest order — so a
    // logged-in customer could never attach one.
    const token = typeof req.query.token === 'string' && req.query.token ? req.query.token : null;
    if (!token) throw notFound('Order not found');
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, guestToken: token },
      include: { address: true },
    });
    if (!order) throw notFound('Order not found');
    if (order.userId) throw badRequest('This order already belongs to an account');
    if (!order.guestEmail) throw badRequest('This order has no email to create an account with');

    // Already signed in? Attach the order to that account instead of making a
    // second one. Safe because the token proves they hold this order, and it's
    // how a returning customer consolidates an order they placed as a guest.
    if (req.auth) {
      const attached = await prisma.$transaction(async (tx) => {
        const o = await tx.order.update({
          where: { id: order.id },
          data: { userId: req.auth!.userId },
          include: orderInclude,
        });
        if (order.addressId) {
          await tx.address.update({
            where: { id: order.addressId },
            data: { userId: req.auth!.userId },
          });
        }
        return o;
      });
      res.json({ attached: true, order: serialize(attached) });
      return;
    }

    // Never overwrite or silently take over an existing account — that would
    // let anyone holding a guest token reset a real customer's password.
    const existing = await prisma.user.findUnique({ where: { email: order.guestEmail } });
    if (existing) {
      throw badRequest('An account with this email already exists — please log in instead');
    }

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: order.address?.fullName ?? 'Customer',
          email: order.guestEmail!,
          phone: order.address?.phone ?? null,
          passwordHash: await bcrypt.hash(req.body.password, 10),
        },
      });
      // Attach only THIS order. Other guest orders sharing the email are
      // deliberately left alone: email ownership is never verified in this app,
      // so sweeping them in would let someone who ordered using another
      // person's address inherit that person's order history.
      await tx.order.update({ where: { id: order.id }, data: { userId: user.id } });
      // Carry the shipping address over so it's saved for next time.
      if (order.addressId) {
        await tx.address.update({ where: { id: order.addressId }, data: { userId: user.id } });
      }
      return user;
    });

    const tokens = await issueTokens(created.id, 'CUSTOMER');
    res.status(201).json({ user: toAuthUser(created), ...tokens });
  }),
);

// GET /orders — current user's order history (accounts only; a guest has no
// history to list, which is exactly why the confirmation email carries a link).
ordersRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.auth!.userId },
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ orders: serialize(orders) });
  }),
);

// GET /orders/:id — own order, by session OR by the guest token issued at
// checkout. The token must match this specific order, so it grants access to
// nothing else; an order id alone is never sufficient.
ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: orderOwnershipWhere(req),
      include: orderInclude,
    });
    if (!order) throw notFound('Order not found');
    res.json({ order: serialize(order) });
  }),
);

// POST /orders/:id/cancel — cancel if still cancellable.
// Same ownership rule as GET /orders/:id. NOTE: `userId: undefined` would make
// Prisma drop the condition entirely and match any order, so the owner check is
// built explicitly rather than by interpolating a possibly-undefined userId.
ordersRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: orderOwnershipWhere(req),
      include: { items: true },
    });
    if (!order) throw notFound('Order not found');
    const cancellable: OrderStatus[] = [OrderStatus.PLACED, OrderStatus.CONFIRMED];
    if (!cancellable.includes(order.status)) {
      throw badRequest('This order can no longer be cancelled');
    }
    const updated = await prisma.$transaction(async (tx) => {
      // Restock.
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
      return tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: req.body?.reason ?? 'Cancelled by customer',
          statusLogs: { create: { status: OrderStatus.CANCELLED, note: 'Cancelled by customer' } },
        },
        include: orderInclude,
      });
    });
    res.json({ order: serialize(updated) });
  }),
);
