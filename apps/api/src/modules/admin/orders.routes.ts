import { Router } from 'express';
import { z } from 'zod';
import { prisma, Prisma, OrderStatus, PaymentStatus } from '@store/database';
import { updateOrderStatusSchema } from '@store/shared-types';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { serialize } from '../../lib/serialize';
import { notFound } from '../../lib/errors';
import { toNum } from '../../lib/money';
import { notifyOrderStatus } from '../../lib/notify';
import { auditMeta } from '../../middleware/auditLog';

export const adminOrdersRouter = Router();

const orderInclude = {
  items: true,
  address: true,
  payments: true,
  statusLogs: { orderBy: { createdAt: 'asc' } },
  user: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.OrderInclude;

/**
 * Who to notify about an order. Guest orders have no `user`, so contact details
 * come from the email captured at checkout plus the shipping address. Without
 * this, guests would silently receive no status updates at all.
 */
function recipientFor(order: {
  guestEmail: string | null;
  user: { name: string; email: string; phone: string | null } | null;
  address: { fullName: string; phone: string } | null;
}) {
  if (order.user) return order.user;
  if (!order.guestEmail) return null;
  return {
    name: order.address?.fullName ?? 'Customer',
    email: order.guestEmail,
    phone: order.address?.phone ?? null,
  };
}

// GET /admin/orders — filterable list
adminOrdersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const where: Prisma.OrderWhereInput = {};
    if (req.query.status) where.status = String(req.query.status) as never;
    if (req.query.paymentMethod) where.paymentMethod = String(req.query.paymentMethod) as never;
    if (req.query.search) {
      where.OR = [
        { orderNumber: { contains: String(req.query.search) } },
        { user: { email: { contains: String(req.query.search) } } },
        // Guest orders have no user row — match the email they checked out with,
        // plus the name/phone on the shipping address, so support can find them.
        { guestEmail: { contains: String(req.query.search) } },
        { address: { fullName: { contains: String(req.query.search) } } },
        { address: { phone: { contains: String(req.query.search) } } },
      ];
    }
    const [total, items] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          // Falls back to the address for guest name/phone in the list view.
          address: { select: { fullName: true, phone: true } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ items: serialize(items), total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  }),
);

adminOrdersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude });
    if (!order) throw notFound('Order not found');
    res.json({ order: serialize(order) });
  }),
);

// PATCH /admin/orders/:id/status — update status (triggers notification in Phase 3)
adminOrdersRouter.patch(
  '/:id/status',
  validate(updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const { status, note } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: status as OrderStatus,
        // Delivered COD orders are considered paid on delivery.
        ...(status === 'DELIVERED' ? { paymentStatus: PaymentStatus.PAID } : {}),
        statusLogs: { create: { status: status as OrderStatus, note } },
      },
      include: orderInclude,
    });
    auditMeta(res, { orderNumber: order.orderNumber, status });
    // Notify the customer of the status change (email + WhatsApp), best-effort.
    // Works for guests too — see recipientFor().
    const recipient = recipientFor(order);
    if (recipient) notifyOrderStatus(order, recipient);
    res.json({ order: serialize(order) });
  }),
);

// PATCH /admin/orders/:id/payment — set payment status (COD reconciliation, refunds)
adminOrdersRouter.patch(
  '/:id/payment',
  validate(z.object({ paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']), codVerified: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        paymentStatus: req.body.paymentStatus as PaymentStatus,
        ...(req.body.codVerified != null ? { codVerified: req.body.codVerified } : {}),
      },
      include: orderInclude,
    });
    res.json({ order: serialize(order) });
  }),
);

// GET /admin/orders/:id/invoice — invoice data (PDF rendered client-side/print)
adminOrdersRouter.get(
  '/:id/invoice',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude });
    if (!order) throw notFound('Order not found');
    res.json({ invoice: serialize(order) });
  }),
);

// ─────────────── Customers ───────────────
adminOrdersRouter.get(
  '/customers/list',
  asyncHandler(async (req, res) => {
    const search = req.query.search ? String(req.query.search) : undefined;
    const customers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        ...(search
          ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] }
          : {}),
      },
      include: { _count: { select: { orders: true } }, orders: { select: { total: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const list = customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      isBlocked: c.isBlocked,
      orderCount: c._count.orders,
      lifetimeValue: c.orders.reduce((s, o) => s + toNum(o.total), 0),
      createdAt: c.createdAt,
    }));
    res.json({ customers: serialize(list) });
  }),
);

adminOrdersRouter.patch(
  '/customers/:id/block',
  validate(z.object({ isBlocked: z.boolean() })),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBlocked: req.body.isBlocked },
    });
    res.json({ ok: true, isBlocked: user.isBlocked });
  }),
);
