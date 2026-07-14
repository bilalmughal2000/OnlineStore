import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@store/database';
import { couponInputSchema, sectionInputSchema } from '@store/shared-types';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { serialize } from '../../lib/serialize';

export const adminMarketingRouter = Router();

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
  title: z.string().optional(),
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
adminMarketingRouter.get(
  '/activity',
  asyncHandler(async (_req, res) => {
    const logs = await prisma.adminActivityLog.findMany({
      include: { admin: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ logs: serialize(logs) });
  }),
);
