import { Router } from 'express';
import { Prisma, prisma, ProductStatus } from '@store/database';
import { productQuerySchema, type Paginated } from '@store/shared-types';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { serialize } from '../../lib/serialize';
import { cached } from '../../lib/cache';
import { notFound } from '../../lib/errors';

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

    if (q.category) {
      and.push({
        category: {
          OR: [{ slug: q.category }, { parent: { slug: q.category } }],
        },
      });
    }
    if (q.search) {
      and.push({
        OR: [
          { title: { contains: q.search, mode: 'insensitive' } },
          { description: { contains: q.search, mode: 'insensitive' } },
          { brand: { contains: q.search, mode: 'insensitive' } },
        ],
      });
    }
    if (q.brand) and.push({ brand: { equals: q.brand, mode: 'insensitive' } });
    if (q.onSale) and.push({ salePrice: { not: null } });
    if (q.minPrice != null) and.push({ basePrice: { gte: q.minPrice } });
    if (q.maxPrice != null) and.push({ basePrice: { lte: q.maxPrice } });
    if (q.size || q.color || q.inStock) {
      and.push({
        variants: {
          some: {
            ...(q.size ? { size: q.size } : {}),
            ...(q.color ? { color: { equals: q.color, mode: 'insensitive' } } : {}),
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
          { title: { contains: term, mode: 'insensitive' } },
          { brand: { contains: term, mode: 'insensitive' } },
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
