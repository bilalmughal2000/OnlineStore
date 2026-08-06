import { prisma } from '@store/database';
import { DEFAULT_BRANDING, emailButton, renderEmailLayout, type EmailBranding } from './layout';
import { EMAIL_TEMPLATES, type EmailTemplateKey } from './templates';

/**
 * Turns a template key + data into a finished subject and HTML.
 *
 * Resolution order: an enabled admin-saved template, otherwise the built-in
 * default. Storing only the body means a heavily-edited template still comes
 * out on brand, and disabling a row instantly restores the default — which is
 * the escape hatch for a bad edit.
 */

/** Branding pulled from Settings; falls back to sensible defaults. */
export async function getEmailBranding(): Promise<EmailBranding> {
  const [storeRow, emailRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'store' } }),
    prisma.setting.findUnique({ where: { key: 'email' } }),
  ]);
  const store = (storeRow?.value ?? {}) as Record<string, unknown>;
  const email = (emailRow?.value ?? {}) as Record<string, unknown>;

  return {
    storeName: (email.storeName as string) || (store.name as string) || DEFAULT_BRANDING.storeName,
    accentColor: (email.accentColor as string) || DEFAULT_BRANDING.accentColor,
    logoUrl: (email.logoUrl as string) || null,
    headerImageUrl: (email.headerImageUrl as string) || null,
    footerText: (email.footerText as string) || null,
    supportEmail: (email.supportEmail as string) || null,
    supportPhone: (email.supportPhone as string) || null,
    storefrontUrl: (process.env.STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  };
}

/**
 * Replaces {{placeholders}}.
 *
 * An unknown placeholder becomes an empty string rather than being left as
 * literal `{{foo}}` — a typo in an edited template should look like a small gap,
 * not like broken software in a customer's inbox.
 */
export function substitute(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name: string) => vars[name] ?? '');
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export async function renderEmail(
  key: EmailTemplateKey,
  vars: Record<string, string>,
  opts: { branding?: EmailBranding; cta?: { label: string; url: string } | null } = {},
): Promise<RenderedEmail> {
  const def = EMAIL_TEMPLATES[key];
  const branding = opts.branding ?? (await getEmailBranding());

  const saved = await prisma.emailTemplate.findUnique({ where: { key } }).catch(() => null);
  const useSaved = saved?.isEnabled && saved.html?.trim();

  const subjectSource = useSaved ? saved!.subject : def.subject;
  const bodySource = useSaved ? saved!.html : def.html;

  // The CTA is built here, not written into the template, so the button keeps
  // its brand colour and Outlook-safe markup no matter how the copy is edited.
  const allVars: Record<string, string> = {
    storeName: branding.storeName,
    ...vars,
    ctaButton: opts.cta ? emailButton(opts.cta.label, opts.cta.url, branding.accentColor) : '',
  };

  return {
    subject: substitute(subjectSource, allVars),
    html: renderEmailLayout(substitute(bodySource, allVars), branding, {
      preheader: substitute(def.description, allVars),
    }),
  };
}

/** Items table for the order confirmation. Table-based for Outlook. */
export function renderItemsTable(
  items: { productTitle: string; variantLabel?: string | null; quantity: number; lineTotal: string }[],
): string {
  const rows = items
    .map(
      (i) => `<tr>
  <td style="padding:11px 0;border-bottom:1px solid #f0efed;color:#292524">
    ${i.productTitle}${i.variantLabel ? `<br><span style="color:#a8a29e;font-size:13px">${i.variantLabel}</span>` : ''}
    <span style="color:#a8a29e"> × ${i.quantity}</span>
  </td>
  <td align="right" style="padding:11px 0;border-bottom:1px solid #f0efed;white-space:nowrap;font-weight:600;color:#1c1917">${i.lineTotal}</td>
</tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:15px">${rows}</table>`;
}

/** Order links list for the "find my orders" email. */
export function renderOrdersList(
  orders: { orderNumber: string; date: string; url: string }[],
  accentColor: string,
): string {
  const rows = orders
    .map(
      (o) => `<tr>
  <td style="padding:12px 0;border-bottom:1px solid #f0efed">
    <a href="${o.url}" style="color:${accentColor};text-decoration:none;font-weight:600">${o.orderNumber}</a>
    <br><span style="color:#a8a29e;font-size:13px">${o.date}</span>
  </td>
</tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:15px">${rows}</table>`;
}
