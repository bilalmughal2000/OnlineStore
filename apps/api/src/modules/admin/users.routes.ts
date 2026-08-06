import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma, Prisma, Role } from '@store/database';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireRole } from '../../middleware/auth';
import { serialize } from '../../lib/serialize';
import { toNum } from '../../lib/money';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { auditMeta } from '../../middleware/auditLog';

export const adminUsersRouter = Router();

// User management is ADMIN-only (STAFF cannot manage accounts).
adminUsersRouter.use(requireRole('ADMIN'));

const roleEnum = z.enum(['CUSTOMER', 'STAFF', 'ADMIN']);

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8).max(72),
  role: roleEnum.default('CUSTOMER'),
  isBlocked: z.boolean().default(false),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  role: roleEnum.optional(),
  isBlocked: z.boolean().optional(),
  password: z.string().min(8).max(72).optional(), // optional password reset
});

const publicSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isBlocked: true,
  createdAt: true,
  _count: { select: { orders: true } },
} satisfies Prisma.UserSelect;

// GET /admin/users — list with search + role filter
adminUsersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const where: Prisma.UserWhereInput = {};
    if (req.query.role) where.role = String(req.query.role) as Role;
    if (req.query.hasOrders === 'true') where.orders = { some: {} }; // bought something
    if (req.query.search) {
      const s = String(req.query.search);
      where.OR = [{ name: { contains: s } }, { email: { contains: s } }];
    }
    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: { ...publicSelect, orders: { select: { total: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    // Attach lifetime value; drop the raw orders array from the response.
    const items = rows.map(({ orders, ...u }) => ({
      ...u,
      lifetimeValue: orders.reduce((s, o) => s + toNum(o.total), 0),
    }));
    res.json({ items: serialize(items), total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  }),
);

/**
 * GET /admin/users/guests — customers who bought without creating an account.
 *
 * They have no User row, so there is nothing to list from the users table.
 * Their identity is the email captured at checkout, and everything else — name,
 * phone, city — comes from the shipping address on their most recent order.
 * Orders are therefore grouped by `guestEmail` to synthesise a customer record.
 *
 * MUST stay above `/:id`, or that route matches "guests" and returns 404.
 */
adminUsersRouter.get(
  '/guests',
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 20), 200);

    const where: Prisma.OrderWhereInput = { userId: null, guestEmail: { not: null } };
    if (req.query.search) {
      const s = String(req.query.search);
      where.OR = [
        { guestEmail: { contains: s } },
        { address: { fullName: { contains: s } } },
        { address: { phone: { contains: s } } },
        { orderNumber: { contains: s } },
      ];
    }

    // One row per guest email, ordered by most recent activity.
    const [groups, distinct] = await Promise.all([
      prisma.order.groupBy({
        by: ['guestEmail'],
        where,
        _count: { _all: true },
        _sum: { total: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: 'desc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      // Total distinct guests, for pagination.
      prisma.order.findMany({ where, select: { guestEmail: true }, distinct: ['guestEmail'] }),
    ]);

    const emails = groups.map((g) => g.guestEmail!).filter(Boolean);

    // Latest order per guest supplies the display name / phone / city, plus a
    // cancelled-order count so lifetime value can be read honestly.
    const [recentOrders, cancelled, existingAccounts] = await Promise.all([
      prisma.order.findMany({
        where: { userId: null, guestEmail: { in: emails } },
        select: {
          guestEmail: true,
          createdAt: true,
          address: { select: { fullName: true, phone: true, city: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.groupBy({
        by: ['guestEmail'],
        where: { userId: null, guestEmail: { in: emails }, status: 'CANCELLED' },
        _count: { _all: true },
        _sum: { total: true },
      }),
      // A guest may have registered later. Flagging it stops staff treating one
      // person as two separate customers.
      prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } }),
    ]);

    const latestByEmail = new Map<string, (typeof recentOrders)[number]>();
    for (const o of recentOrders) {
      if (o.guestEmail && !latestByEmail.has(o.guestEmail)) latestByEmail.set(o.guestEmail, o);
    }
    const cancelledByEmail = new Map(cancelled.map((c) => [c.guestEmail!, c]));
    const accountByEmail = new Map(existingAccounts.map((u) => [u.email, u.id]));

    const items = groups.map((g) => {
      const email = g.guestEmail!;
      const latest = latestByEmail.get(email);
      const cancelledRow = cancelledByEmail.get(email);
      const cancelledValue = toNum(cancelledRow?._sum.total ?? 0);
      return {
        email,
        name: latest?.address?.fullName ?? '—',
        phone: latest?.address?.phone ?? null,
        city: latest?.address?.city ?? null,
        ordersCount: g._count._all,
        cancelledCount: cancelledRow?._count._all ?? 0,
        // Excludes cancelled orders — otherwise a guest who cancelled everything
        // would look like your best customer.
        lifetimeValue: toNum(g._sum.total ?? 0) - cancelledValue,
        firstOrderAt: g._min.createdAt,
        lastOrderAt: g._max.createdAt,
        hasAccount: accountByEmail.has(email),
        accountId: accountByEmail.get(email) ?? null,
      };
    });

    const total = distinct.length;
    res.json({
      items: serialize(items),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  }),
);

adminUsersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: publicSelect });
    if (!user) throw notFound('User not found');
    res.json({ user: serialize(user) });
  }),
);

// POST /admin/users — create a user with any role
adminUsersRouter.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) throw badRequest('A user with this email already exists');

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        role: body.role as Role,
        isBlocked: body.isBlocked,
        passwordHash: await bcrypt.hash(body.password, 10),
      },
      select: publicSelect,
    });
    res.status(201).json({ user: serialize(user) });
  }),
);

// PATCH /admin/users/:id — update details / role / block / reset password
adminUsersRouter.patch(
  '/:id',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateSchema>;
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound('User not found');

    const isSelf = req.auth!.userId === target.id;
    // Guard against locking yourself out.
    if (isSelf && body.role && body.role !== target.role) throw forbidden('You cannot change your own role');
    if (isSelf && body.isBlocked) throw forbidden('You cannot block your own account');

    // Don't allow removing the last remaining admin.
    if (target.role === 'ADMIN' && body.role && body.role !== 'ADMIN') {
      const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) throw badRequest('Cannot demote the last admin');
    }

    if (body.email && body.email !== target.email) {
      const clash = await prisma.user.findUnique({ where: { email: body.email } });
      if (clash) throw badRequest('A user with this email already exists');
    }

    const data: Prisma.UserUpdateInput = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role as Role | undefined,
      isBlocked: body.isBlocked,
    };
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.update({ where: { id: target.id }, data, select: publicSelect });
    res.json({ user: serialize(user) });
  }),
);

// DELETE /admin/users/:id
adminUsersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.auth!.userId) throw forbidden('You cannot delete your own account');
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound('User not found');
    if (target.role === 'ADMIN') {
      const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) throw badRequest('Cannot delete the last admin');
    }
    await prisma.user.delete({ where: { id: target.id } });
    // The row is about to vanish, so record who it was — an id alone would
    // leave the audit trail pointing at nothing.
    auditMeta(res, { email: target.email, role: target.role });
    res.json({ ok: true });
  }),
);
