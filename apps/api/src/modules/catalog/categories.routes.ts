import { Router } from 'express';
import { prisma } from '@store/database';
import { asyncHandler } from '../../lib/asyncHandler';
import { serialize } from '../../lib/serialize';
import { notFound } from '../../lib/errors';

export const categoriesRouter = Router();

// GET /categories — active category tree (parents with children)
categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const parents = await prisma.category.findMany({
      where: { parentId: null, isActive: true },
      include: {
        children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ categories: serialize(parents) });
  }),
);

// GET /categories/:slug — single category + its children
categoriesRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({
      where: { slug: req.params.slug },
      include: { children: { where: { isActive: true } }, parent: true },
    });
    if (!category) throw notFound('Category not found');
    res.json({ category: serialize(category) });
  }),
);
