import nodemailer, { type Transporter } from 'nodemailer';
import { toNum } from './money';
import { getEmailBranding, renderEmail, renderItemsTable, renderOrdersList } from './email/render';

/**
 * Notification layer for order events.
 *
 * Channels are pluggable and independent:
 *  - Email  → SMTP (nodemailer). Falls back to console logging in dev when
 *             SMTP_HOST is not configured.
 *  - WhatsApp → official Cloud API (utility template). No-ops (logs) when not
 *             configured. Requires a verified WhatsApp Business Account and an
 *             approved template — see .env.example.
 *
 * All sends are best-effort: failures are logged, never thrown, so they can
 * never break order placement or status updates.
 */

const fmtPKR = (n: number) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n);

// ─────────────────────────── Email ───────────────────────────
//
// Two transports, chosen automatically:
//
//   1. HTTP API (Mailtrap) — used when MAILTRAP_API_TOKEN is set.
//   2. SMTP (nodemailer)   — used when SMTP_HOST is set.
//
// HTTP exists because most hosting platforms, Railway included, block outbound
// SMTP ports as an anti-spam measure. The connection simply times out
// (ETIMEDOUT), so SMTP cannot work there at all. HTTPS is never blocked.
//
// On cPanel the mailbox lives on the same host, so SMTP works fine — leave the
// Mailtrap token unset there and this falls back to it with no code change.

const mailtrapToken = process.env.MAILTRAP_API_TOKEN ?? '';
/** Sandbox inbox id. Set = nothing is delivered; unset = Mailtrap sends for real. */
const mailtrapInboxId = process.env.MAILTRAP_INBOX_ID ?? '';
const httpEmailConfigured = Boolean(mailtrapToken);

/** Splits `Aabroo <orders@aabroo.pk>` into its parts; the HTTP API wants them separate. */
function parseFrom(value: string): { email: string; name?: string } {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1] || undefined, email: match[2] };
  return { email: value.trim() };
}

async function sendViaHttp(to: string, subject: string, html: string): Promise<string> {
  // The sandbox and live endpoints take an identical body — only the URL differs.
  const url = mailtrapInboxId
    ? `https://sandbox.api.mailtrap.io/api/send/${mailtrapInboxId}`
    : 'https://send.api.mailtrap.io/api/send';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Api-Token': mailtrapToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: parseFrom(process.env.EMAIL_FROM ?? 'orders@store.pk'),
      to: [{ email: to }],
      subject,
      html,
    }),
    // Sending is fire-and-forget, so an unbounded request would hang silently.
    signal: AbortSignal.timeout(15_000),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Mailtrap API ${res.status}: ${body.slice(0, 300)}`);
  return body.slice(0, 200);
}

let transporter: Transporter | null = null;
const smtpConfigured = Boolean(process.env.SMTP_HOST);

function getTransporter(): Transporter | null {
  if (!smtpConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      // Without these nodemailer waits indefinitely. Since sending is
      // fire-and-forget, a host that silently drops outbound SMTP would leave
      // the promise pending forever and produce no log line at all — the
      // failure would be invisible rather than reported.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transporter;
}

/**
 * Every outcome is logged. Silence used to be ambiguous — a missing recipient,
 * a missing SMTP config and a successful send all produced no output, which
 * makes "the email never arrived" impossible to diagnose from the logs.
 */
async function sendEmail(to: string | null, subject: string, html: string): Promise<void> {
  // The ENTIRE body is guarded. Callers invoke this inside
  // `void Promise.allSettled([...])`, which discards rejections — so anything
  // thrown outside a try (previously: building the transporter) disappeared
  // with no log at all, leaving "the email never arrived" with zero evidence.
  try {
    if (!to) {
      console.warn(`[email] SKIPPED "${subject}" — no recipient address on the record`);
      return;
    }
    // HTTP first: it works on hosts that block outbound SMTP.
    if (httpEmailConfigured) {
      const response = await sendViaHttp(to, subject, html);
      console.log(`[email] SENT via HTTP "${subject}" -> ${to} ${response}`);
      return;
    }

    const from = process.env.EMAIL_FROM ?? 'orders@store.pk';
    const tx = getTransporter();
    if (!tx) {
      // Also surface any links so a developer can follow them from the console —
      // guest order links carry a token and are otherwise only in a real inbox.
      const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      console.log(`[email:dev] No email transport configured — logging instead of sending`);
      console.log(`[email:dev] To: ${to} | ${subject}`);
      for (const l of links) console.log(`[email:dev]   link: ${l}`);
      return;
    }
    const info = await tx.sendMail({ from, to, subject, html });
    console.log(`[email] SENT via SMTP "${subject}" -> ${to} (${info.messageId}) ${info.response ?? ''}`);
  } catch (err) {
    console.error(
      `[email] FAILED "${subject}" -> ${to}: ${(err as Error).message}`,
      (err as NodeJS.ErrnoException).code ?? '',
    );
  }
}

// ─────────────────────────── WhatsApp ───────────────────────────
const waConfigured = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);

// Normalise a Pakistani number to E.164 digits (923001234567).
function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  if (digits.startsWith('3')) return `92${digits}`;
  return digits;
}

/**
 * Sends an approved WhatsApp utility template. `params` fill the template's
 * body placeholders ({{1}}, {{2}}, …) in order.
 */
async function sendWhatsApp(phone: string | null, params: string[]): Promise<void> {
  const to = toE164(phone);
  if (!to) return;
  if (!waConfigured) {
    console.log(`[whatsapp:dev] To: ${to} | ${params.join(' | ')}`);
    return;
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: process.env.WHATSAPP_TEMPLATE_ORDER ?? 'order_update',
            language: { code: process.env.WHATSAPP_LANG ?? 'en' },
            components: [
              { type: 'body', parameters: params.map((text) => ({ type: 'text', text })) },
            ],
          },
        }),
      },
    );
    if (!res.ok) console.error('[whatsapp] send failed:', res.status, await res.text());
  } catch (err) {
    console.error('[whatsapp] send failed:', (err as Error).message);
  }
}

// ─────────────────────────── Public API ───────────────────────────
interface OrderLike {
  id: string;
  orderNumber: string;
  total: unknown;
  paymentMethod: string;
  status: string;
  items?: { productTitle: string; quantity: number; price: unknown }[];
}
interface Recipient {
  name: string;
  email: string | null;
  phone: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  PLACED: 'placed',
  CONFIRMED: 'confirmed',
  PACKED: 'packed',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'out for delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
};

export function notifyOrderPlaced(
  order: OrderLike,
  to: Recipient,
  // Guest orders have no account to log into, so the email carries a tokenised
  // link — it's the buyer's only way back to their order.
  opts: { guestToken?: string | null } = {},
): void {
  const total = fmtPKR(toNum(order.total as never));
  const storefrontUrl = (process.env.STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const orderUrl = opts.guestToken
    ? `${storefrontUrl}/order-confirmation/${order.id}?token=${opts.guestToken}`
    : `${storefrontUrl}/account/orders`;

  void (async () => {
    try {
      const { subject, html } = await renderEmail(
        'ORDER_PLACED',
        {
          firstName: to.name.split(' ')[0],
          customerName: to.name,
          orderNumber: order.orderNumber,
          orderTotal: total,
          paymentMethod: order.paymentMethod,
          orderUrl,
          itemsTable: renderItemsTable(
            (order.items ?? []).map((i) => ({
              productTitle: i.productTitle,
              variantLabel: (i as { variantLabel?: string | null }).variantLabel ?? null,
              quantity: i.quantity,
              lineTotal: fmtPKR(toNum(i.price as never) * i.quantity),
            })),
          ),
        },
        { cta: { label: opts.guestToken ? 'View your order' : 'View your orders', url: orderUrl } },
      );
      await sendEmail(to.email, subject, html);
    } catch (err) {
      console.error('[email] render failed for ORDER_PLACED:', (err as Error).message);
    }
  })();

  void sendWhatsApp(to.phone, [to.name.split(' ')[0], order.orderNumber, total]);
}

/**
 * Emails a guest the links to the orders placed with their address.
 *
 * This is what makes "find my past orders" safe: the links only ever reach the
 * inbox that owns the email, so receiving one proves possession. That's the
 * property auto-linking guest orders at signup lacks, since registration never
 * verifies the address.
 */
export function notifyOrderLinks(
  email: string,
  orders: { id: string; orderNumber: string; guestToken: string | null; createdAt: Date }[],
): void {
  const storefrontUrl = (process.env.STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  void (async () => {
    try {
      const branding = await getEmailBranding();
      const { subject, html } = await renderEmail(
        'ORDER_LINKS',
        {
          ordersList: renderOrdersList(
            orders
              .filter((o) => o.guestToken)
              .map((o) => ({
                orderNumber: o.orderNumber,
                date: new Date(o.createdAt).toLocaleDateString('en-PK'),
                url: `${storefrontUrl}/order-confirmation/${o.id}?token=${o.guestToken}`,
              })),
            branding.accentColor,
          ),
        },
        { branding },
      );
      await sendEmail(email, subject, html);
    } catch (err) {
      console.error('[email] render failed for ORDER_LINKS:', (err as Error).message);
    }
  })();
}

/**
 * Sends the password-reset link.
 *
 * Uses the same sendEmail() as everything else, so it works before any mail
 * provider is configured (the link is logged) and starts delivering the moment
 * one is — with no code change.
 */
export function notifyPasswordReset(email: string, name: string, token: string): void {
  const storefrontUrl = (process.env.STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const resetUrl = `${storefrontUrl}/reset-password?token=${encodeURIComponent(token)}`;

  void (async () => {
    try {
      const { subject, html } = await renderEmail(
        'PASSWORD_RESET',
        { firstName: name.split(' ')[0], customerName: name, resetUrl },
        { cta: { label: 'Choose a new password', url: resetUrl } },
      );
      await sendEmail(email, subject, html);
    } catch (err) {
      console.error('[email] render failed for PASSWORD_RESET:', (err as Error).message);
    }
  })();
}

export function notifyOrderStatus(order: OrderLike, to: Recipient): void {
  const label = STATUS_LABEL[order.status] ?? order.status;
  const storefrontUrl = (process.env.STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const orderUrl = `${storefrontUrl}/account/orders`;

  void (async () => {
    try {
      const { subject, html } = await renderEmail(
        'ORDER_STATUS',
        {
          firstName: to.name.split(' ')[0],
          customerName: to.name,
          orderNumber: order.orderNumber,
          statusLabel: label,
          orderUrl,
        },
        { cta: { label: 'Track your order', url: orderUrl } },
      );
      await sendEmail(to.email, subject, html);
    } catch (err) {
      console.error('[email] render failed for ORDER_STATUS:', (err as Error).message);
    }
  })();

  void sendWhatsApp(to.phone, [to.name.split(' ')[0], order.orderNumber, label]);
}

/**
 * Sends already-rendered HTML and RETURNS the outcome instead of logging it.
 * Used by the admin "send test" action, which needs the failure reason back.
 */
export async function sendRenderedEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; transport?: 'http' | 'smtp'; error?: string; code?: string; response?: string }> {
  try {
    if (httpEmailConfigured) {
      const response = await sendViaHttp(to, subject, html);
      return { ok: true, transport: 'http', response };
    }
    const tx = getTransporter();
    if (!tx) return { ok: false, error: 'No email transport configured (set MAILTRAP_API_TOKEN or SMTP_HOST)' };
    const info = await tx.sendMail({ from: process.env.EMAIL_FROM ?? 'orders@store.pk', to, subject, html });
    return { ok: true, transport: 'smtp', response: info.response };
  } catch (err) {
    return {
      ok: false,
      transport: httpEmailConfigured ? 'http' : 'smtp',
      error: (err as Error).message,
      code: (err as NodeJS.ErrnoException).code,
    };
  }
}

/**
 * Sends a test email and RETURNS the outcome, rather than logging it.
 *
 * Used by the admin diagnostics endpoint. Everything else sends fire-and-forget
 * so a mail problem can never break an order — but that also means failures are
 * only visible in logs. This surfaces the actual SMTP error to the caller.
 */
export async function sendTestEmail(
  to: string,
): Promise<{
  ok: boolean;
  transport?: 'http' | 'smtp';
  messageId?: string;
  response?: string;
  error?: string;
  code?: string;
}> {
  const html =
    '<h2>It works</h2><p>Your store can send email. Sent from the admin diagnostics endpoint.</p>';
  try {
    if (httpEmailConfigured) {
      const response = await sendViaHttp(to, 'Aabroo — test email', html);
      return { ok: true, transport: 'http', response };
    }
    const tx = getTransporter();
    if (!tx) {
      return { ok: false, error: 'No email transport configured (set MAILTRAP_API_TOKEN or SMTP_HOST)' };
    }
    const info = await tx.sendMail({
      from: process.env.EMAIL_FROM ?? 'orders@store.pk',
      to,
      subject: 'Aabroo — test email',
      html,
    });
    return { ok: true, transport: 'smtp', messageId: info.messageId, response: info.response };
  } catch (err) {
    return {
      ok: false,
      transport: httpEmailConfigured ? 'http' : 'smtp',
      error: (err as Error).message,
      code: (err as NodeJS.ErrnoException).code,
    };
  }
}
