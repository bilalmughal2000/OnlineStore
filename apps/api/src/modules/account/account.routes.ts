import { Router } from 'express';
import { prisma } from '@store/database';
import { addressSchema, reviewInputSchema } from '@store/shared-types';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { serialize } from '../../lib/serialize';
import { notFound, badRequest } from '../../lib/errors';

export const accountRouter = Router();
accountRouter.use(requireAuth);

// ─────────────── Addresses ───────────────
accountRouter.get(
  '/addresses',
  asyncHandler(async (req, res) => {
    const addresses = await prisma.address.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { isDefault: 'desc' },
    });
    res.json({ addresses: serialize(addresses) });
  }),
);

accountRouter.post(
  '/addresses',
  validate(addressSchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    if (req.body.isDefault) {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const address = await prisma.address.create({ data: { ...req.body, userId } });
    res.status(201).json({ address: serialize(address) });
  }),
);

accountRouter.patch(
  '/addresses/:id',
  validate(addressSchema.partial()),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) throw notFound('Address not found');
    if (req.body.isDefault) {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const address = await prisma.address.update({ where: { id: req.params.id }, data: req.body });
    res.json({ address: serialize(address) });
  }),
);

accountRouter.delete(
  '/addresses/:id',
  asyncHandler(async (req, res) => {
    await prisma.address.deleteMany({ where: { id: req.params.id, userId: req.auth!.userId } });
    res.json({ ok: true });
  }),
);

// ─────────────── Wishlist ───────────────
accountRouter.get(
  '/wishlist',
  asyncHandler(async (req, res) => {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.auth!.userId },
      include: {
        product: { include: { images: { where: { isPrimary: true }, take: 1 } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items: serialize(items) });
  }),
);

accountRouter.post(
  '/wishlist',
  validate(z.object({ productId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const item = await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.auth!.userId, productId: req.body.productId } },
      update: {},
      create: { userId: req.auth!.userId, productId: req.body.productId },
    });
    res.status(201).json({ item: serialize(item) });
  }),
);

accountRouter.delete(
  '/wishlist/:productId',
  asyncHandler(async (req, res) => {
    await prisma.wishlistItem.deleteMany({
      where: { userId: req.auth!.userId, productId: req.params.productId },
    });
    res.json({ ok: true });
  }),
);

// ─────────────── Reviews (customer creates; needs approval) ───────────────
accountRouter.post(
  '/products/:productId/reviews',
  validate(reviewInputSchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const productId = req.params.productId;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw notFound('Product not found');

    // Any logged-in customer can review. A "verified buyer" flag is derived from
    // whether they've received the product (shown as a badge on the storefront).
    const purchased = await prisma.orderItem.findFirst({
      where: { order: { userId, status: 'DELIVERED' }, variant: { productId } },
    });

    // One review per user per product (editable). Auto-approved so it shows at once.
    const review = await prisma.review.upsert({
      where: { productId_userId: { productId, userId } },
      update: { rating: req.body.rating, comment: req.body.comment, images: req.body.images, isApproved: true },
      create: { productId, userId, rating: req.body.rating, comment: req.body.comment, images: req.body.images, isApproved: true },
      include: { user: { select: { name: true } } },
    });

    // Recompute the product's rating aggregate from approved reviews.
    const agg = await prisma.review.aggregate({
      where: { productId, isApproved: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await prisma.product.update({
      where: { id: productId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all },
    });

    res.status(201).json({ review: serialize({ ...review, verified: Boolean(purchased) }) });
  }),
);
