import { Router } from 'express';
import { prisma, Prisma, ProductStatus, SectionType } from '@store/database';
import { asyncHandler } from '../../lib/asyncHandler';
import { serialize } from '../../lib/serialize';
import { cached } from '../../lib/cache';
import { notFound } from '../../lib/errors';

export const contentRouter = Router();

const productCardInclude = {
  images: { orderBy: { sortOrder: 'asc' } },
  variants: true,
} satisfies Prisma.ProductInclude;

// GET /content/homepage — resolves active sections into ready-to-render data
contentRouter.get(
  '/homepage',
  asyncHandler(async (_req, res) => {
    const data = await cached('content:homepage', 60, async () => {
    const now = new Date();
    const [sections, banners, categories] = await Promise.all([
      prisma.homepageSection.findMany({
        where: {
          isActive: true,
          OR: [{ startDate: null }, { startDate: { lte: now } }],
          AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
        },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.banner.findMany({
        where: { isActive: true, position: 'hero' },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.category.findMany({
        where: { parentId: null, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    // Social proof: recent 5-star reviews with a comment, for the homepage.
    const testimonials = await prisma.review.findMany({
      where: { isApproved: true, rating: 5, comment: { not: null } },
      include: {
        user: { select: { name: true } },
        product: {
          select: { title: true, slug: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    // Populate PRODUCT_GRID sections with their products.
    const resolved = await Promise.all(
      sections.map(async (section) => {
        if (section.type === SectionType.PRODUCT_GRID) {
          const cfg = section.config as Record<string, unknown>;
          const where: Prisma.ProductWhereInput = { status: ProductStatus.PUBLISHED };
          if (cfg.filter === 'featured') where.isFeatured = true;
          if (cfg.filter === 'onSale') where.salePrice = { not: null };
          if (Array.isArray(cfg.productIds) && cfg.productIds.length) {
            where.id = { in: cfg.productIds as string[] };
          }
          const products = await prisma.product.findMany({
            where,
            include: productCardInclude,
            orderBy: cfg.filter === 'newest' ? { createdAt: 'desc' } : { ratingCount: 'desc' },
            take: Number(cfg.limit ?? 8),
          });
          return { ...section, products: serialize(products) };
        }
        if (section.type === SectionType.CATEGORY_TILES) {
          return { ...section, categories: serialize(categories) };
        }
        return section;
      }),
    );

      return {
        banners: serialize(banners),
        sections: serialize(resolved),
        categories: serialize(categories),
        testimonials: serialize(testimonials),
      };
    });
    res.json(data);
  }),
);

// GET /content/menu — header nav is driven by top-level categories (so adding a
// category in the admin shows it in the navbar automatically); footer uses the
// managed footer menu items (static pages).
contentRouter.get(
  '/menu',
  asyncHandler(async (_req, res) => {
    const data = await cached('content:menu', 60, async () => {
      const [categories, footerItems] = await Promise.all([
        prisma.category.findMany({
          where: { parentId: null, isActive: true },
          orderBy: { sortOrder: 'asc' },
        }),
        prisma.menuItem.findMany({
          where: { isActive: true, location: 'footer', parentId: null },
          orderBy: { sortOrder: 'asc' },
        }),
      ]);
      return {
        header: categories.map((c) => ({ id: c.id, label: c.name, url: `/category/${c.slug}` })),
        footer: footerItems,
      };
    });
    res.json(data);
  }),
);

// GET /content/pages/:slug — static page
contentRouter.get(
  '/pages/:slug',
  asyncHandler(async (req, res) => {
    const page = await prisma.staticPage.findFirst({
      where: { slug: req.params.slug, isPublished: true },
    });
    if (!page) throw notFound('Page not found');
    res.json({ page: serialize(page) });
  }),
);

// GET /content/settings — public store settings (name, currency, shipping, enabled payments)
contentRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const data = await cached('content:settings', 300, async () => {
      const rows = await prisma.setting.findMany({
        where: { key: { in: ['store', 'shipping', 'payments'] } },
      });
      // Never expose which payment credentials exist — only enabled flags.
      return { settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) };
    });
    res.json(data);
  }),
);
