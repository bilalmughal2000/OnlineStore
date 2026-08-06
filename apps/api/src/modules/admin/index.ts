import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import { bumpCacheVersion } from '../../lib/cache';
import { pingStorefrontRevalidate } from '../../lib/revalidate';
import { sendTestEmail } from '../../lib/notify';
import { adminDashboardRouter } from './dashboard.routes';
import { adminCatalogRouter } from './catalog.routes';
import { adminOrdersRouter } from './orders.routes';
import { adminMarketingRouter } from './marketing.routes';
import { adminUploadsRouter } from './uploads.routes';
import { adminUsersRouter } from './users.routes';

export const adminRouter = Router();

// Every admin route requires ADMIN or STAFF role (RBAC enforced server-side).
adminRouter.use(requireRole('ADMIN', 'STAFF'));

// Any successful admin write invalidates the public read cache.
adminRouter.use((req, res, next) => {
  if (req.method !== 'GET') {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        bumpCacheVersion();
        pingStorefrontRevalidate();
      }
    });
  }
  next();
});

/**
 * GET /admin/diagnostics — what the *running* server actually has configured.
 *
 * Environment variables are set on the hosting platform, so "is SMTP on?" can't
 * be answered by reading the repo — only by asking the process. Reports booleans
 * and non-sensitive values only; never credentials.
 */
adminRouter.get('/diagnostics', (_req, res) => {
  const smtpHost = process.env.SMTP_HOST ?? '';
  res.json({
    nodeEnv: process.env.NODE_ENV ?? null,
    email: {
      configured: Boolean(smtpHost),
      host: smtpHost || null,
      port: process.env.SMTP_PORT ?? null,
      secure: process.env.SMTP_SECURE ?? null,
      userSet: Boolean(process.env.SMTP_USER),
      passSet: Boolean(process.env.SMTP_PASS),
      from: process.env.EMAIL_FROM ?? null,
    },
    storefrontUrl: process.env.STOREFRONT_URL ?? null,
    corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
    cloudinaryConfigured: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
    redisConfigured: Boolean(process.env.REDIS_URL),
    metaCapiConfigured: Boolean(process.env.META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN),
    whatsappConfigured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN),
  });
});

/**
 * POST /admin/diagnostics/test-email — proves whether this server can actually
 * send, and returns the SMTP result instead of hiding it in a log.
 *
 * Order emails are fire-and-forget by design (they must never block checkout),
 * which means their failures are invisible to the caller. This does the same
 * send synchronously so the reason for a failure comes straight back.
 */
adminRouter.post('/diagnostics/test-email', async (req, res) => {
  const to = typeof req.body?.to === 'string' ? req.body.to : null;
  if (!to) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Provide "to"' } });
  const result = await sendTestEmail(to);
  res.status(result.ok ? 200 : 500).json(result);
});

adminRouter.use('/dashboard', adminDashboardRouter);
adminRouter.use('/uploads', adminUploadsRouter);
adminRouter.use('/users', adminUsersRouter);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/', adminCatalogRouter); // /products, /categories, /attributes
adminRouter.use('/', adminMarketingRouter); // /coupons, /sections, /banners, /reviews, /settings, /pages
