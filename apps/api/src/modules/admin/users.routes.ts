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
import { logActivity } from './helpers';

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
    await logActivity(req.auth!.userId, 'create', 'User', user.id, { email: user.email, role: user.role });
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
    await logActivity(req.auth!.userId, 'update', 'User', user.id);
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
    await logActivity(req.auth!.userId, 'delete', 'User', target.id, { email: target.email });
    res.json({ ok: true });
  }),
);
