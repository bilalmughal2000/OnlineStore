import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { notFound } from '../../lib/errors';
import { categoryIndex } from './category-tree';

export const categoriesRouter = Router();

// GET /categories — the full active category tree, nested to any depth.
categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { roots } = await categoryIndex();
    res.json({ categories: roots });
  }),
);

// GET /categories/:slug — a category with its whole subtree, plus the context a
// listing page needs to draw navigation: the ancestor trail (breadcrumbs) and
// the top-level branch it belongs to (the sidebar tree).
categoriesRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const { bySlug, trail } = await categoryIndex();
    const category = bySlug.get(req.params.slug);
    if (!category) throw notFound('Category not found');

    const path = trail.get(category.slug) ?? [category];
    // `branch` below already carries every node, so the trail is sent without
    // its subtrees rather than repeating the whole tree once per level.
    const ancestors = path.slice(0, -1).map(({ children: _children, ...c }) => c);

    res.json({
      category: { ...category, parent: ancestors.at(-1) ?? null },
      ancestors,
      // Root of this category's tree — the sidebar shows the whole branch so a
      // shopper can move sideways ("Kurtis" → "Sarees") without going back up.
      branch: path[0],
    });
  }),
);
