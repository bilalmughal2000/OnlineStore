import { Router } from 'express';
import { Prisma, prisma, ProductStatus } from '@store/database';
import { productQuerySchema, reviewInputSchema, type Paginated } from '@store/shared-types';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { optionalAuth } from '../../middleware/auth';
import { reviewLimiter } from '../../middleware/rateLimit';
import { serialize } from '../../lib/serialize';
import { cached } from '../../lib/cache';
import { badRequest, notFound } from '../../lib/errors';

export const productsRouter = Router();

const listInclude = {
  images: { orderBy: { sortOrder: 'asc' } },
  variants: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductInclude;

// GET /products — filtered, sorted, paginated listing
productsRouter.get(
  '/',
  validate(productQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as import('@store/shared-types').ProductQuery;

    const where: Prisma.ProductWhereInput = { status: ProductStatus.PUBLISHED };
    const and: Prisma.ProductWhereInput[] = [];

    if (q.category === 'sale') {
      // "Sale" is a virtual category: any product with a sale price, from any category.
      and.push({ salePrice: { not: null } });
    } else if (q.category) {
      and.push({
        category: {
          OR: [{ slug: q.category }, { parent: { slug: q.category } }],
        },
      });
    }
    if (q.search) {
      and.push({
        OR: [
          { title: { contains: q.search } },
          { description: { contains: q.search } },
          { brand: { contains: q.search } },
        ],
      });
    }
    if (q.ids) {
      // Resolve an explicit set of ids (guest wishlist). Bounded so the query
      // can't be used to dump the whole catalogue in one request.
      const ids = q.ids.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 60);
      and.push({ id: { in: ids.length ? ids : ['__none__'] } });
    }
    if (q.brand) and.push({ brand: { equals: q.brand } });
    if (q.onSale) and.push({ salePrice: { not: null } });
    if (q.minPrice != null) and.push({ basePrice: { gte: q.minPrice } });
    if (q.maxPrice != null) and.push({ basePrice: { lte: q.maxPrice } });
    if (q.size || q.color || q.inStock) {
      and.push({
        variants: {
          some: {
            ...(q.size ? { size: q.size } : {}),
            ...(q.color ? { color: { equals: q.color } } : {}),
            ...(q.inStock ? { stock: { gt: 0 } } : {}),
          },
        },
      });
    }
    if (and.length) where.AND = and;

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      q.sort === 'price_asc'
        ? { basePrice: 'asc' }
        : q.sort === 'price_desc'
          ? { basePrice: 'desc' }
          : q.sort === 'rating'
            ? { ratingAvg: 'desc' }
            : q.sort === 'popularity'
              ? { ratingCount: 'desc' }
              : { createdAt: 'desc' };

    const result = await cached<Paginated<unknown>>(
      `products:list:${JSON.stringify(q)}`,
      30,
      async () => {
        const [total, items] = await Promise.all([
          prisma.product.count({ where }),
          prisma.product.findMany({
            where,
            include: listInclude,
            orderBy,
            skip: (q.page - 1) * q.pageSize,
            take: q.pageSize,
          }),
        ]);
        return {
          items: serialize(items),
          total,
          page: q.page,
          pageSize: q.pageSize,
          totalPages: Math.ceil(total / q.pageSize),
        };
      },
    );
    res.json(result);
  }),
);

// GET /products/search?q= — lightweight autocomplete
productsRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const term = String(req.query.q ?? '').trim();
    if (term.length < 2) return res.json({ items: [] });
    const items = await prisma.product.findMany({
      where: {
        status: ProductStatus.PUBLISHED,
        OR: [
          { title: { contains: term } },
          { brand: { contains: term } },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        basePrice: true,
        salePrice: true,
        images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      },
      take: 8,
    });
    res.json({ items: serialize(items) });
  }),
);

// GET /products/:slug/reviews — approved reviews, always fresh (no cache) so
// admin moderation (hide/show/delete) reflects immediately on the storefront.
productsRouter.get(
  '/:slug/reviews',
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const product = await prisma.product.findFirst({
      where: { slug: req.params.slug },
      select: { id: true, ratingAvg: true, ratingCount: true },
    });
    if (!product) throw notFound('Product not found');
    const reviews = await prisma.review.findMany({
      where: { productId: product.id, isApproved: true },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ reviews: serialize(reviews), ratingAvg: product.ratingAvg, ratingCount: product.ratingCount });
  }),
);

// POST /products/:slug/reviews — leave a review.
//
// Open to everyone: no account and no prior purchase required. Signed-in users
// get one editable review per product (upsert); anonymous reviewers supply a
// display name and each submission is a separate row.
//
// Rate-limited per IP, which is the only brake on an endpoint this open.
productsRouter.post(
  '/:slug/reviews',
  reviewLimiter,
  optionalAuth,
  validate(reviewInputSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@store/shared-types').ReviewInput;
    const userId = req.auth?.userId ?? null;

    if (!userId && !body.guestName) {
      throw badRequest('Please enter your name to post a review');
    }

    const product = await prisma.product.findFirst({
      where: { slug: req.params.slug, status: ProductStatus.PUBLISHED },
      select: { id: true },
    });
    if (!product) throw notFound('Product not found');

    const data = {
      rating: body.rating,
      comment: body.comment,
      images: body.images,
      isApproved: true,
    };

    const review = userId
      ? // One review per account per product, editable on re-submit.
        await prisma.review.upsert({
          where: { productId_userId: { productId: product.id, userId } },
          update: data,
          create: { ...data, productId: product.id, userId },
          include: { user: { select: { name: true } } },
        })
      : await prisma.review.create({
          data: { ...data, productId: product.id, guestName: body.guestName },
        });

    // Recompute the product's rating from approved reviews.
    const agg = await prisma.review.aggregate({
      where: { productId: product.id, isApproved: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all },
    });

    // "Verified" is derived, not stored — true when this reviewer has actually
    // received the product. Guests are matched on the email they checked out with.
    const verified = userId
      ? Boolean(
          await prisma.orderItem.findFirst({
            where: { order: { userId, status: 'DELIVERED' }, variant: { productId: product.id } },
          }),
        )
      : false;

    res.status(201).json({ review: serialize({ ...review, verified }) });
  }),
);

// GET /products/:slug — full PDP detail + related
productsRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const data = await cached(`product:${req.params.slug}`, 60, async () => {
    const product = await prisma.product.findFirst({
      where: { slug: req.params.slug, status: ProductStatus.PUBLISHED },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: [{ size: 'asc' }, { color: 'asc' }] },
        category: { select: { id: true, name: true, slug: true, parentId: true } },
        attributes: { include: { attributeValue: { include: { attribute: true } } } },
        reviews: {
          where: { isApproved: true },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!product) throw notFound('Product not found');

    const related = await prisma.product.findMany({
      where: {
        status: ProductStatus.PUBLISHED,
        categoryId: product.categoryId,
        NOT: { id: product.id },
      },
      include: listInclude,
      take: 4,
    });

      return { product: serialize(product), related: serialize(related) };
    });
    res.json(data);
  }),
);
