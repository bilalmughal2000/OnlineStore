import { Router } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@store/database';
import { announcementInputSchema, couponInputSchema, sectionInputSchema } from '@store/shared-types';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireRole } from '../../middleware/auth';
import { auditMeta } from '../../middleware/auditLog';
import { serialize } from '../../lib/serialize';
import { badRequest } from '../../lib/errors';

export const adminMarketingRouter = Router();

/**
 * Owner-only areas inside this router.
 *
 * The rest of /admin is open to STAFF, but these three control money and
 * accountability rather than day-to-day operations:
 *   - /coupons  — a discount code is a direct, unreviewed withdrawal from margin
 *   - /settings — shipping rates, the COD ceiling and which payment methods run
 *   - /activity — the audit trail; whoever is being audited must not curate it
 *
 * `.use()` matches by prefix, so this also covers /coupons/:id, /settings/:key etc.
 */
adminMarketingRouter.use(['/coupons', '/settings', '/activity', '/announcements'], requireRole('ADMIN'));

// ─────────────── Coupons ───────────────
adminMarketingRouter.get(
  '/coupons',
  asyncHandler(async (_req, res) => {
    res.json({ coupons: serialize(await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } })) });
  }),
);

adminMarketingRouter.post(
  '/coupons',
  validate(couponInputSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const coupon = await prisma.coupon.create({
      data: {
        ...b,
        startsAt: b.startsAt ? new Date(b.startsAt) : null,
        expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
      },
    });
    res.status(201).json({ coupon: serialize(coupon) });
  }),
);

adminMarketingRouter.put(
  '/coupons/:id',
  validate(couponInputSchema.partial()),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const coupon = await prisma.coupon.update({
      where: { id: req.params.id },
      data: {
        ...b,
        ...(b.startsAt !== undefined ? { startsAt: b.startsAt ? new Date(b.startsAt) : null } : {}),
        ...(b.expiresAt !== undefined ? { expiresAt: b.expiresAt ? new Date(b.expiresAt) : null } : {}),
      },
    });
    res.json({ coupon: serialize(coupon) });
  }),
);

adminMarketingRouter.delete(
  '/coupons/:id',
  asyncHandler(async (req, res) => {
    await prisma.coupon.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

// ─────────────── Homepage sections ───────────────
adminMarketingRouter.get(
  '/sections',
  asyncHandler(async (_req, res) => {
    res.json({ sections: serialize(await prisma.homepageSection.findMany({ orderBy: { sortOrder: 'asc' } })) });
  }),
);

adminMarketingRouter.post(
  '/sections',
  validate(sectionInputSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const section = await prisma.homepageSection.create({
      data: {
        ...b,
        startDate: b.startDate ? new Date(b.startDate) : null,
        endDate: b.endDate ? new Date(b.endDate) : null,
      },
    });
    res.status(201).json({ section: serialize(section) });
  }),
);

adminMarketingRouter.put(
  '/sections/:id',
  validate(sectionInputSchema.partial()),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const section = await prisma.homepageSection.update({
      where: { id: req.params.id },
      data: {
        ...b,
        ...(b.startDate !== undefined ? { startDate: b.startDate ? new Date(b.startDate) : null } : {}),
        ...(b.endDate !== undefined ? { endDate: b.endDate ? new Date(b.endDate) : null } : {}),
      },
    });
    res.json({ section: serialize(section) });
  }),
);

adminMarketingRouter.delete(
  '/sections/:id',
  asyncHandler(async (req, res) => {
    await prisma.homepageSection.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

// POST /admin/sections/reorder — drag-and-drop ordering
adminMarketingRouter.post(
  '/sections/reorder',
  validate(z.object({ order: z.array(z.string()) })),
  asyncHandler(async (req, res) => {
    await prisma.$transaction(
      req.body.order.map((id: string, i: number) =>
        prisma.homepageSection.update({ where: { id }, data: { sortOrder: i } }),
      ),
    );
    res.json({ ok: true });
  }),
);

// ─────────────── Banners ───────────────
const bannerSchema = z.object({
  title: z.string().optional().nullable(),
  subtitle: z.string().optional().nullable(),
  ctaLabel: z.string().optional().nullable(),
  imageUrl: z.string().url(),
  mobileImageUrl: z.string().url().optional().nullable(),
  link: z.string().optional().nullable(),
  position: z.string().default('hero'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

adminMarketingRouter.get(
  '/banners',
  asyncHandler(async (_req, res) => {
    res.json({ banners: serialize(await prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } })) });
  }),
);

adminMarketingRouter.post(
  '/banners',
  validate(bannerSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ banner: serialize(await prisma.banner.create({ data: req.body })) });
  }),
);

adminMarketingRouter.put(
  '/banners/:id',
  validate(bannerSchema.partial()),
  asyncHandler(async (req, res) => {
    res.json({ banner: serialize(await prisma.banner.update({ where: { id: req.params.id }, data: req.body })) });
  }),
);

adminMarketingRouter.delete(
  '/banners/:id',
  asyncHandler(async (req, res) => {
    await prisma.banner.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

adminMarketingRouter.post(
  '/banners/reorder',
  validate(z.object({ order: z.array(z.string()) })),
  asyncHandler(async (req, res) => {
    await prisma.$transaction(
      req.body.order.map((id: string, i: number) =>
        prisma.banner.update({ where: { id }, data: { sortOrder: i } }),
      ),
    );
    res.json({ ok: true });
  }),
);

// ─────────────── Reviews moderation ───────────────
adminMarketingRouter.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    // filter: 'visible' | 'hidden' | undefined (all)
    const filter = String(req.query.filter ?? '');
    const where =
      filter === 'visible' ? { isApproved: true } : filter === 'hidden' ? { isApproved: false } : {};
    const reviews = await prisma.review.findMany({
      where,
      include: { user: { select: { name: true } }, product: { select: { title: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ reviews: serialize(reviews) });
  }),
);

adminMarketingRouter.patch(
  '/reviews/:id',
  validate(z.object({ isApproved: z.boolean().optional(), reply: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const review = await prisma.review.update({ where: { id: req.params.id }, data: req.body });
    // Recompute product rating aggregate from approved reviews.
    const agg = await prisma.review.aggregate({
      where: { productId: review.productId, isApproved: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await prisma.product.update({
      where: { id: review.productId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all },
    });
    res.json({ review: serialize(review) });
  }),
);

adminMarketingRouter.delete(
  '/reviews/:id',
  asyncHandler(async (req, res) => {
    const review = await prisma.review.delete({ where: { id: req.params.id } });
    // Recompute the product's rating aggregate after removal.
    const agg = await prisma.review.aggregate({
      where: { productId: review.productId, isApproved: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await prisma.product.update({
      where: { id: review.productId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all },
    });
    res.json({ ok: true });
  }),
);

// ─────────────── Announcements ───────────────
//
// Event sales and store-wide notices. Dates are optional on both sides: no
// startDate means "live as soon as it's active", no endDate means "until I turn
// it off".
const announcementBody = announcementInputSchema.extend({
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

/** Empty string from a datetime-local input means "no bound", not epoch 0. */
function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

adminMarketingRouter.get(
  '/announcements',
  asyncHandler(async (_req, res) => {
    const announcements = await prisma.announcement.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ announcements: serialize(announcements) });
  }),
);

adminMarketingRouter.post(
  '/announcements',
  validate(announcementBody),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof announcementBody>;
    const announcement = await prisma.announcement.create({
      data: { ...body, startDate: toDate(body.startDate), endDate: toDate(body.endDate) },
    });
    res.status(201).json({ announcement: serialize(announcement) });
  }),
);

adminMarketingRouter.put(
  '/announcements/:id',
  validate(announcementBody.partial()),
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<z.infer<typeof announcementBody>>;
    const announcement = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        ...body,
        ...('startDate' in body ? { startDate: toDate(body.startDate) } : {}),
        ...('endDate' in body ? { endDate: toDate(body.endDate) } : {}),
      },
    });
    res.json({ announcement: serialize(announcement) });
  }),
);

// Priority order. Decides which announcement pops up first when several are
// live, and the order the ribbon rotates through them.
adminMarketingRouter.post(
  '/announcements/reorder',
  validate(z.object({ order: z.array(z.string()) })),
  asyncHandler(async (req, res) => {
    await prisma.$transaction(
      req.body.order.map((id: string, i: number) =>
        prisma.announcement.update({ where: { id }, data: { sortOrder: i } }),
      ),
    );
    res.json({ ok: true });
  }),
);

adminMarketingRouter.delete(
  '/announcements/:id',
  asyncHandler(async (req, res) => {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

// ─────────────── Settings ───────────────
adminMarketingRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.setting.findMany();
    res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  }),
);

adminMarketingRouter.put(
  '/settings/:key',
  validate(z.object({ value: z.any() })),
  asyncHandler(async (req, res) => {
    const setting = await prisma.setting.upsert({
      where: { key: req.params.key },
      update: { value: req.body.value },
      create: { key: req.params.key, value: req.body.value },
    });
    res.json({ setting: serialize(setting) });
  }),
);

// ─────────────── Static pages ───────────────
const pageSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  content: z.string(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  isPublished: z.boolean().default(true),
});

adminMarketingRouter.get(
  '/pages',
  asyncHandler(async (_req, res) => {
    res.json({ pages: serialize(await prisma.staticPage.findMany({ orderBy: { title: 'asc' } })) });
  }),
);

adminMarketingRouter.put(
  '/pages/:slug',
  validate(pageSchema.partial()),
  asyncHandler(async (req, res) => {
    const page = await prisma.staticPage.upsert({
      where: { slug: req.params.slug },
      update: req.body,
      create: { slug: req.params.slug, title: req.body.title ?? req.params.slug, content: req.body.content ?? '', ...req.body },
    });
    res.json({ page: serialize(page) });
  }),
);

// ─────────────── Activity log ───────────────

/**
 * Turns `from`/`to` query params into a createdAt filter.
 *
 * `to` is treated as inclusive of the whole day: a user picking 5 Aug in a date
 * input means "up to the end of 5 Aug", not midnight at its start — otherwise
 * selecting a single day as both ends matches nothing.
 */
function dateRangeWhere(from: unknown, to: unknown): Prisma.DateTimeFilter | undefined {
  const range: Prisma.DateTimeFilter = {};
  if (typeof from === 'string' && from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) range.gte = d;
  }
  if (typeof to === 'string' && to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      if (!to.includes('T')) d.setHours(23, 59, 59, 999);
      range.lte = d;
    }
  }
  return range.gte || range.lte ? range : undefined;
}

adminMarketingRouter.get(
  '/activity',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const action = typeof req.query.action === 'string' ? req.query.action : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
    const createdAt = dateRangeWhere(req.query.from, req.query.to);

    const where: Prisma.AdminActivityLogWhereInput = {
      ...(action ? { action } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(search
        ? {
            OR: [
              { adminName: { contains: search } },
              { adminEmail: { contains: search } },
              { entity: { contains: search } },
              { entityId: { contains: search } },
              { action: { contains: search } },
            ],
          }
        : {}),
    };

    // adminName/adminEmail are stored on the row, so entries stay attributable
    // after the account is deleted; no join needed.
    const [logs, total] = await Promise.all([
      prisma.adminActivityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.adminActivityLog.count({ where }),
    ]);
    res.json({ logs: serialize(logs), total, page, pageSize });
  }),
);

/**
 * DELETE /admin/activity — retention cleanup.
 *
 * Requires an explicit `before` or `from`/`to`; there is deliberately no way to
 * wipe the whole log in one unguarded call. The purge is itself audited (the
 * middleware records this request), so the trail always shows that a deletion
 * happened, who did it, and how much it removed.
 */
adminMarketingRouter.delete(
  '/activity',
  asyncHandler(async (req, res) => {
    const createdAt = dateRangeWhere(req.query.from, req.query.before ?? req.query.to);
    if (!createdAt) {
      throw badRequest('Specify a date range: pass "before", or "from" and "to".');
    }
    const { count } = await prisma.adminActivityLog.deleteMany({ where: { createdAt } });
    auditMeta(res, {
      deleted: count,
      from: createdAt.gte ?? null,
      to: createdAt.lte ?? null,
    });
    res.json({ ok: true, deleted: count });
  }),
);
