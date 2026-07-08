import { Router } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@store/database';
import { productInputSchema, categoryInputSchema, productQuerySchema } from '@store/shared-types';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { serialize } from '../../lib/serialize';
import { notFound } from '../../lib/errors';
import { uniqueSlug, logActivity } from './helpers';

export const adminCatalogRouter = Router();

const fullInclude = {
  images: { orderBy: { sortOrder: 'asc' } },
  variants: true,
  category: true,
} satisfies Prisma.ProductInclude;

// ─────────────── Products ───────────────

// GET /admin/products — all products (any status), searchable
adminCatalogRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const search = req.query.search ? String(req.query.search) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    const where: Prisma.ProductWhereInput = {};
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (status) where.status = status as never;

    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: fullInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ items: serialize(items), total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  }),
);

adminCatalogRouter.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: fullInclude,
    });
    if (!product) throw notFound('Product not found');
    res.json({ product: serialize(product) });
  }),
);

adminCatalogRouter.post(
  '/products',
  validate(productInputSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@store/shared-types').ProductInput;
    const slug = await uniqueSlug(body.slug || body.title, 'product');
    const product = await prisma.product.create({
      data: {
        title: body.title,
        slug,
        description: body.description,
        basePrice: body.basePrice,
        salePrice: body.salePrice ?? null,
        costPrice: body.costPrice ?? null,
        sku: body.sku,
        status: body.status,
        isFeatured: body.isFeatured,
        brand: body.brand,
        fabric: body.fabric,
        categoryId: body.categoryId ?? null,
        seoTitle: body.seoTitle,
        seoDescription: body.seoDescription,
        sizeChartImage: body.sizeChartImage ?? null,
        sizeChartTable: body.sizeChartTable ?? undefined,
        images: {
          create: body.images.map((im, i) => ({
            url: im.url,
            alt: im.alt,
            isPrimary: im.isPrimary ?? i === 0,
            sortOrder: i,
          })),
        },
        variants: {
          create: body.variants.map((v) => ({
            size: v.size,
            color: v.color,
            colorHex: v.colorHex,
            sku: v.sku,
            priceOverride: v.priceOverride ?? null,
            stock: v.stock,
          })),
        },
      },
      include: fullInclude,
    });
    await logActivity(req.auth!.userId, 'create', 'Product', product.id, { title: product.title });
    res.status(201).json({ product: serialize(product) });
  }),
);

adminCatalogRouter.put(
  '/products/:id',
  validate(productInputSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@store/shared-types').ProductInput;
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Product not found');

    const slug = body.slug ? await uniqueSlug(body.slug, 'product', existing.id) : existing.slug;

    // Replace images and variants wholesale (simple, predictable admin UX).
    const product = await prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: existing.id } });
      // Only delete variants no longer present to preserve order-item FKs.
      const keepIds = body.variants.filter((v) => v.id).map((v) => v.id!) as string[];
      await tx.productVariant.deleteMany({
        where: { productId: existing.id, id: { notIn: keepIds.length ? keepIds : ['__none__'] } },
      });
      for (const v of body.variants) {
        if (v.id) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              size: v.size,
              color: v.color,
              colorHex: v.colorHex,
              sku: v.sku,
              priceOverride: v.priceOverride ?? null,
              stock: v.stock,
            },
          });
        } else {
          await tx.productVariant.create({
            data: {
              productId: existing.id,
              size: v.size,
              color: v.color,
              colorHex: v.colorHex,
              sku: v.sku,
              priceOverride: v.priceOverride ?? null,
              stock: v.stock,
            },
          });
        }
      }
      return tx.product.update({
        where: { id: existing.id },
        data: {
          title: body.title,
          slug,
          description: body.description,
          basePrice: body.basePrice,
          salePrice: body.salePrice ?? null,
          costPrice: body.costPrice ?? null,
          sku: body.sku,
          status: body.status,
          isFeatured: body.isFeatured,
          brand: body.brand,
          fabric: body.fabric,
          categoryId: body.categoryId ?? null,
          seoTitle: body.seoTitle,
          seoDescription: body.seoDescription,
          sizeChartImage: body.sizeChartImage ?? null,
          sizeChartTable: body.sizeChartTable ?? Prisma.DbNull,
          images: {
            create: body.images.map((im, i) => ({
              url: im.url,
              alt: im.alt,
              isPrimary: im.isPrimary ?? i === 0,
              sortOrder: i,
            })),
          },
        },
        include: fullInclude,
      });
    });
    await logActivity(req.auth!.userId, 'update', 'Product', product.id);
    res.json({ product: serialize(product) });
  }),
);

adminCatalogRouter.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    await prisma.product.delete({ where: { id: req.params.id } });
    await logActivity(req.auth!.userId, 'delete', 'Product', req.params.id);
    res.json({ ok: true });
  }),
);

// Bulk actions: activate / deactivate / assign category
adminCatalogRouter.post(
  '/products/bulk',
  validate(
    z.object({
      ids: z.array(z.string()).min(1),
      action: z.enum(['publish', 'archive', 'draft', 'assignCategory', 'feature', 'unfeature']),
      categoryId: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { ids, action, categoryId } = req.body;
    const data: Prisma.ProductUpdateManyMutationInput = {};
    if (action === 'publish') data.status = 'PUBLISHED';
    if (action === 'archive') data.status = 'ARCHIVED';
    if (action === 'draft') data.status = 'DRAFT';
    if (action === 'feature') data.isFeatured = true;
    if (action === 'unfeature') data.isFeatured = false;
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: action === 'assignCategory' ? { categoryId } : data,
    });
    res.json({ updated: result.count });
  }),
);

// ─────────────── Categories ───────────────

adminCatalogRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } }, parent: { select: { name: true } } },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
    });
    res.json({ categories: serialize(categories) });
  }),
);

adminCatalogRouter.post(
  '/categories',
  validate(categoryInputSchema),
  asyncHandler(async (req, res) => {
    const slug = await uniqueSlug(req.body.slug || req.body.name, 'category');
    const category = await prisma.category.create({ data: { ...req.body, slug } });
    res.status(201).json({ category: serialize(category) });
  }),
);

adminCatalogRouter.put(
  '/categories/:id',
  validate(categoryInputSchema.partial()),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
    res.json({ category: serialize(category) });
  }),
);

adminCatalogRouter.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

// ─────────────── Attributes ───────────────
adminCatalogRouter.get(
  '/attributes',
  asyncHandler(async (_req, res) => {
    const attributes = await prisma.attribute.findMany({ include: { values: true } });
    res.json({ attributes: serialize(attributes) });
  }),
);
