import { Router } from 'express';
import {
  prisma,
  Prisma,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@store/database';
import { checkoutSchema } from '@store/shared-types';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { checkoutLimiter } from '../../middleware/rateLimit';
import { badRequest, notFound } from '../../lib/errors';
import { serialize } from '../../lib/serialize';
import { priceCart } from './pricing';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

function orderNumber(seq: number): string {
  return `PK${String(Date.now()).slice(-8)}${String(seq % 1000).padStart(3, '0')}`;
}

const orderInclude = {
  items: true,
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
    const userId = req.auth!.userId;
    const body = req.body as import('@store/shared-types').CheckoutInput;

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });
    if (!cart || cart.items.length === 0) throw badRequest('Your cart is empty');

    // Resolve shipping address (existing or new).
    let addressId = body.addressId;
    if (!addressId && body.newAddress) {
      const addr = await prisma.address.create({
        data: { ...body.newAddress, userId },
      });
      addressId = addr.id;
    }
    if (!addressId) throw badRequest('A shipping address is required');
    const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!address) throw notFound('Address not found');

    // Authoritative server-side pricing (never trust client totals).
    const pricing = await priceCart(
      cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      { couponCode: body.couponCode, userId },
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
      // Clear the cart.
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return created;
    });

    // TODO(Phase 4): for STRIPE/JAZZCASH/EASYPAISA, initiate the gateway session
    // here and return a redirect/checkout URL instead of a completed order.
    // TODO(Phase 3): trigger order-confirmation email + SMS.

    res.status(201).json({
      order: serialize(order),
      payment:
        body.paymentMethod === 'COD'
          ? { method: 'COD', status: 'PENDING', redirectUrl: null }
          : { method: body.paymentMethod, status: 'PENDING', redirectUrl: null, note: 'Gateway integration pending (Phase 4)' },
    });
  }),
);

// GET /orders — current user's order history
ordersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.auth!.userId },
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ orders: serialize(orders) });
  }),
);

// GET /orders/:id — order detail (own order only)
ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.auth!.userId },
      include: orderInclude,
    });
    if (!order) throw notFound('Order not found');
    res.json({ order: serialize(order) });
  }),
);

// POST /orders/:id/cancel — cancel if still cancellable
ordersRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.auth!.userId },
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
