import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@store/database';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { serialize } from '../../lib/serialize';
import { notFound } from '../../lib/errors';
import { EMAIL_TEMPLATES, TEMPLATE_KEYS, type EmailTemplateKey } from '../../lib/email/templates';
import { getEmailBranding, renderEmail, renderItemsTable, renderOrdersList } from '../../lib/email/render';
import { sendRenderedEmail } from '../../lib/notify';

export const adminEmailRouter = Router();

const isKey = (k: string): k is EmailTemplateKey => (TEMPLATE_KEYS as string[]).includes(k);

/**
 * Sample data for preview and test sends.
 *
 * Composite placeholders (the items table, the orders list) are built with the
 * same renderers used at send time, so the preview shows the real thing rather
 * than an approximation that might hide a layout problem.
 */
function sampleVars(key: EmailTemplateKey, accentColor: string): Record<string, string> {
  const base = { ...EMAIL_TEMPLATES[key].sample };
  if (key === 'ORDER_PLACED') {
    base.itemsTable = renderItemsTable([
      { productTitle: 'Embroidered Lawn Kurti', variantLabel: 'M / Maroon', quantity: 1, lineTotal: 'Rs 2,799' },
      { productTitle: 'Kundan Earrings', variantLabel: 'Gold', quantity: 2, lineTotal: 'Rs 2,598' },
    ]);
    base.orderUrl = '#';
  }
  if (key === 'ORDER_LINKS') {
    base.ordersList = renderOrdersList(
      [
        { orderNumber: 'PK12345678001', date: '5 Aug 2026', url: '#' },
        { orderNumber: 'PK12345678002', date: '28 Jul 2026', url: '#' },
      ],
      accentColor,
    );
  }
  if (key === 'ORDER_STATUS' || key === 'PASSWORD_RESET') base.orderUrl = '#';
  return base;
}

const ctaFor = (key: EmailTemplateKey): { label: string; url: string } | null =>
  key === 'ORDER_PLACED'
    ? { label: 'View your order', url: '#' }
    : key === 'ORDER_STATUS'
      ? { label: 'Track your order', url: '#' }
      : key === 'PASSWORD_RESET'
        ? { label: 'Choose a new password', url: '#' }
        : null;

// GET /admin/email/templates — every template, with its saved override if any.
adminEmailRouter.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    const saved = await prisma.emailTemplate.findMany();
    const byKey = new Map(saved.map((t) => [t.key, t]));

    res.json({
      templates: TEMPLATE_KEYS.map((key) => {
        const def = EMAIL_TEMPLATES[key];
        const row = byKey.get(key);
        return {
          key,
          name: def.name,
          description: def.description,
          variables: def.variables,
          // What's live right now.
          subject: row?.isEnabled ? row.subject : def.subject,
          html: row?.isEnabled ? row.html : def.html,
          isCustomised: Boolean(row?.isEnabled),
          hasDraft: Boolean(row),
          updatedAt: row?.updatedAt ?? null,
          // Always returned so the editor can offer "reset to default".
          defaultSubject: def.subject,
          defaultHtml: def.html,
        };
      }),
    });
  }),
);

// PUT /admin/email/templates/:key — save (and enable/disable) a template.
adminEmailRouter.put(
  '/templates/:key',
  validate(
    z.object({
      subject: z.string().trim().min(1, 'Subject is required').max(300),
      html: z.string().min(1, 'Content is required'),
      isEnabled: z.boolean().default(true),
    }),
  ),
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) throw notFound('Unknown email template');
    const { subject, html, isEnabled } = req.body as { subject: string; html: string; isEnabled: boolean };

    const row = await prisma.emailTemplate.upsert({
      where: { key },
      update: { subject, html, isEnabled },
      create: { key, subject, html, isEnabled },
    });
    res.json({ template: serialize(row) });
  }),
);

// DELETE /admin/email/templates/:key — discard the override, back to default.
adminEmailRouter.delete(
  '/templates/:key',
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) throw notFound('Unknown email template');
    await prisma.emailTemplate.deleteMany({ where: { key } });
    res.json({ ok: true, restored: 'default' });
  }),
);

// POST /admin/email/templates/:key/preview — render with sample data.
// Accepts unsaved subject/html so the editor can preview before saving.
adminEmailRouter.post(
  '/templates/:key/preview',
  validate(z.object({ subject: z.string().optional(), html: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) throw notFound('Unknown email template');

    const branding = await getEmailBranding();
    const { subject, html } = await renderPreview(key, branding, req.body);
    res.json({ subject, html });
  }),
);

// POST /admin/email/templates/:key/test — send the preview to a real address.
adminEmailRouter.post(
  '/templates/:key/test',
  validate(
    z.object({
      to: z.string().trim().email('Enter a valid email address'),
      subject: z.string().optional(),
      html: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    if (!isKey(key)) throw notFound('Unknown email template');

    const branding = await getEmailBranding();
    const rendered = await renderPreview(key, branding, req.body);
    const result = await sendRenderedEmail(req.body.to, `[TEST] ${rendered.subject}`, rendered.html);
    res.status(result.ok ? 200 : 500).json(result);
  }),
);

/** Shared by preview and test send so what you see is what gets sent. */
async function renderPreview(
  key: EmailTemplateKey,
  branding: Awaited<ReturnType<typeof getEmailBranding>>,
  body: { subject?: string; html?: string },
) {
  const vars = sampleVars(key, branding.accentColor);

  // Unsaved editor content wins, so "Preview" reflects what's on screen.
  if (body.html?.trim() || body.subject?.trim()) {
    const def = EMAIL_TEMPLATES[key];
    const { substitute } = await import('../../lib/email/render');
    const { renderEmailLayout, emailButton } = await import('../../lib/email/layout');
    const cta = ctaFor(key);
    const all = {
      storeName: branding.storeName,
      ...vars,
      ctaButton: cta ? emailButton(cta.label, cta.url, branding.accentColor) : '',
    };
    return {
      subject: substitute(body.subject?.trim() || def.subject, all),
      html: renderEmailLayout(substitute(body.html?.trim() || def.html, all), branding, {
        preheader: def.description,
      }),
    };
  }

  return renderEmail(key, vars, { branding, cta: ctaFor(key) });
}
