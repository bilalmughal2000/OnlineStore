import { Router } from 'express';
import { z } from 'zod';
import { prisma, Prisma, OrderStatus, PaymentStatus } from '@store/database';
import { updateOrderStatusSchema } from '@store/shared-types';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { serialize } from '../../lib/serialize';
import { badRequest, notFound } from '../../lib/errors';
import { toNum } from '../../lib/money';
import { notifyOrderStatus } from '../../lib/notify';
import { auditMeta } from '../../middleware/auditLog';
import {
  bookShipment,
  cancelShipment,
  courierSettings,
  CourierError,
  operationalCities,
  pickupAddresses,
  postexConfigured,
  trackShipment,
  trackingUrl,
} from '../../lib/postex';

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

    /*
     * Opt-in auto-booking. A courier failure here must not undo a status change
     * the admin already made, so it is reported as a warning beside a successful
     * response rather than thrown.
     */
    let courierWarning: string | null = null;
    let result = order;
    const cfg = await courierSettings();
    if (
      cfg.enabled &&
      cfg.autoBookOnConfirm &&
      status === OrderStatus.CONFIRMED &&
      !order.trackingNumber &&
      postexConfigured()
    ) {
      try {
        const booked = await bookShipment(order, cfg);
        result = await prisma.order.update({
          where: { id: order.id },
          data: {
            courier: 'postex',
            trackingNumber: booked.trackingNumber,
            courierStatus: booked.status ?? 'Booked',
            courierBookedAt: new Date(),
            courierSyncedAt: new Date(),
            statusLogs: {
              create: {
                status: order.status,
                note: `Booked with PostEx — CN ${booked.trackingNumber} (automatic)`,
              },
            },
          },
          include: orderInclude,
        });
      } catch (err) {
        courierWarning = err instanceof CourierError ? err.message : 'Courier booking failed';
      }
    }

    res.json({ order: serialize(result), ...(courierWarning ? { courierWarning } : {}) });
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

/*
 * ─────────────── Courier (PostEx) ───────────────
 *
 * Booking is deliberately an explicit action, with `autoBookOnConfirm` as an
 * opt-in: printing a label is a real-world commitment, and a mis-clicked status
 * change shouldn't dispatch a rider.
 *
 * The courier's own wording lands in `courierStatus`. It never rewrites
 * `status`: the shop's state machine drives emails and stock, and a courier
 * relabelling a scan must not silently move an order to DELIVERED.
 */

/** Config + connection state for the courier screen in Settings. */
adminOrdersRouter.get(
  '/courier/config',
  asyncHandler(async (_req, res) => {
    const cfg = await courierSettings();
    const configured = postexConfigured();
    // Only ask PostEx for its lists when there's a token to ask with.
    let addresses: { code: string; label: string }[] = [];
    let cities: string[] = [];
    let error: string | null = null;
    if (configured) {
      try {
        [addresses, cities] = await Promise.all([pickupAddresses(), operationalCities()]);
      } catch (err) {
        error = err instanceof CourierError ? err.message : 'Could not load PostEx data';
      }
    }
    res.json({ courier: cfg, configured, addresses, cities, error });
  }),
);

// POST /admin/orders/:id/shipment — book the parcel with the courier
adminOrdersRouter.post(
  '/:id/shipment',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude });
    if (!order) throw notFound('Order not found');
    if (order.trackingNumber) {
      throw badRequest(`Already booked — tracking number ${order.trackingNumber}`);
    }
    if (order.status === OrderStatus.CANCELLED) throw badRequest('This order is cancelled');

    const cfg = await courierSettings();
    const booked = await bookShipment(order, cfg);

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        courier: 'postex',
        trackingNumber: booked.trackingNumber,
        courierStatus: booked.status ?? 'Booked',
        courierBookedAt: new Date(),
        courierSyncedAt: new Date(),
        statusLogs: {
          create: { status: order.status, note: `Booked with PostEx — CN ${booked.trackingNumber}` },
        },
      },
      include: orderInclude,
    });
    auditMeta(res, { orderNumber: order.orderNumber, trackingNumber: booked.trackingNumber });

    // Tell the customer their parcel is on its way, with the number to track it.
    const recipient = recipientFor(updated);
    if (recipient) notifyOrderStatus(updated, recipient);

    res.json({ order: serialize(updated), trackingUrl: trackingUrl(cfg, booked.trackingNumber) });
  }),
);

// POST /admin/orders/:id/shipment/sync — pull the courier's latest scan
adminOrdersRouter.post(
  '/:id/shipment/sync',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw notFound('Order not found');
    if (!order.trackingNumber) throw badRequest('This order has not been booked with a courier yet');

    const result = await trackShipment(order.trackingNumber);
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { courierStatus: result.status ?? order.courierStatus, courierSyncedAt: new Date() },
      include: orderInclude,
    });
    res.json({ order: serialize(updated), history: result.history });
  }),
);

// DELETE /admin/orders/:id/shipment — cancel the booking with the courier
adminOrdersRouter.delete(
  '/:id/shipment',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw notFound('Order not found');
    if (!order.trackingNumber) throw badRequest('Nothing to cancel — no shipment booked');

    await cancelShipment(order.trackingNumber);
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        courier: null,
        trackingNumber: null,
        courierStatus: null,
        courierBookedAt: null,
        courierSyncedAt: null,
        statusLogs: {
          create: { status: order.status, note: `PostEx booking cancelled (was CN ${order.trackingNumber})` },
        },
      },
      include: orderInclude,
    });
    auditMeta(res, { orderNumber: order.orderNumber, cancelledTracking: order.trackingNumber });
    res.json({ order: serialize(updated) });
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
