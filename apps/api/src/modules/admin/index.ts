import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import { bumpCacheVersion } from '../../lib/cache';
import { adminDashboardRouter } from './dashboard.routes';
import { adminCatalogRouter } from './catalog.routes';
import { adminOrdersRouter } from './orders.routes';
import { adminMarketingRouter } from './marketing.routes';
import { adminUploadsRouter } from './uploads.routes';

export const adminRouter = Router();

// Every admin route requires ADMIN or STAFF role (RBAC enforced server-side).
adminRouter.use(requireRole('ADMIN', 'STAFF'));

// Any successful admin write invalidates the public read cache.
adminRouter.use((req, res, next) => {
  if (req.method !== 'GET') {
    res.on('finish', () => {
      if (res.statusCode < 400) bumpCacheVersion();
    });
  }
  next();
});

adminRouter.use('/dashboard', adminDashboardRouter);
adminRouter.use('/uploads', adminUploadsRouter);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/', adminCatalogRouter); // /products, /categories, /attributes
adminRouter.use('/', adminMarketingRouter); // /coupons, /sections, /banners, /reviews, /settings, /pages
