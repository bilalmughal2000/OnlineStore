import { Router } from 'express';
import { prisma, Prisma, ProductStatus, SectionType } from '@store/database';
import { asyncHandler } from '../../lib/asyncHandler';
import { serialize } from '../../lib/serialize';
import { cached } from '../../lib/cache';
import { notFound } from '../../lib/errors';
import { categoryIndex, type CategoryNode } from '../catalog/category-tree';

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

// GET /content/menu — header nav is driven by the category tree (so adding a
// category in the admin shows it in the navbar automatically); footer uses the
// managed footer menu items (static pages).
//
// Each header item carries its nested children to any depth, which is what lets
// the navbar open a dropdown for a parent category instead of hiding whatever
// sits underneath it.
contentRouter.get(
  '/menu',
  asyncHandler(async (_req, res) => {
    const [{ roots }, footerData] = await Promise.all([
      categoryIndex(),
      cached('content:menu:footer', 60, async () => {
        const footerItems = await prisma.menuItem.findMany({
          where: { isActive: true, location: 'footer', parentId: null },
          orderBy: { sortOrder: 'asc' },
        });
        return serialize(footerItems);
      }),
    ]);

    const toMenu = (c: CategoryNode): Record<string, unknown> => ({
      id: c.id,
      label: c.name,
      url: `/category/${c.slug}`,
      slug: c.slug,
      image: c.image,
      productCount: c.productCount,
      children: c.children.map(toMenu),
    });

    res.json({ header: roots.map(toMenu), footer: footerData });
  }),
);

// GET /content/announcements — announcements that are live *right now*.
//
// The date window is evaluated server-side so a scheduled Eid or 14 August sale
// switches itself on and off without anyone touching the admin. Never cached for
// long: an announcement that lingers after its sale ended is worse than none.
contentRouter.get(
  '/announcements',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 5,
    });
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ announcements: serialize(announcements) });
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

// GET /content/sitemap — every indexable URL slug + its last-modified date.
// Feeds the storefront's app/sitemap.ts. Deliberately lean (slug + date only)
// so the whole catalogue fits in one response instead of paging /products.
contentRouter.get(
  '/sitemap',
  asyncHandler(async (_req, res) => {
    const data = await cached('content:sitemap', 600, async () => {
      const [products, categories, pages] = await Promise.all([
        prisma.product.findMany({
          where: { status: ProductStatus.PUBLISHED },
          select: { slug: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.category.findMany({
          where: { isActive: true },
          select: { slug: true },
          orderBy: { sortOrder: 'asc' },
        }),
        prisma.staticPage.findMany({
          where: { isPublished: true },
          select: { slug: true, updatedAt: true },
        }),
      ]);
      return { products: serialize(products), categories: serialize(categories), pages: serialize(pages) };
    });
    res.json(data);
  }),
);

// GET /content/settings — public store settings (name, currency, shipping, enabled payments)
contentRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const data = await cached('content:settings', 300, async () => {
      const rows = await prisma.setting.findMany({
        where: { key: { in: ['store', 'shipping', 'payments', 'whatsapp', 'social'] } },
      });
      // Never expose which payment credentials exist — only enabled flags.
      return { settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) };
    });
    res.json(data);
  }),
);
