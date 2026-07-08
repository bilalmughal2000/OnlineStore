import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import { adminDashboardRouter } from './dashboard.routes';
import { adminCatalogRouter } from './catalog.routes';
import { adminOrdersRouter } from './orders.routes';
import { adminMarketingRouter } from './marketing.routes';

export const adminRouter = Router();

// Every admin route requires ADMIN or STAFF role (RBAC enforced server-side).
adminRouter.use(requireRole('ADMIN', 'STAFF'));

adminRouter.use('/dashboard', adminDashboardRouter);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/', adminCatalogRouter); // /products, /categories, /attributes
adminRouter.use('/', adminMarketingRouter); // /coupons, /sections, /banners, /reviews, /settings, /pages
