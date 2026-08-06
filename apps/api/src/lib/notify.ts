import nodemailer, { type Transporter } from 'nodemailer';
import { toNum } from './money';

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
    const from = process.env.EMAIL_FROM ?? 'orders@store.pk';
    const tx = getTransporter();
    if (!tx) {
      // Also surface any links so a developer can follow them from the console —
      // guest order links carry a token and are otherwise only in a real inbox.
      const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      console.log(`[email:dev] SMTP_HOST not set — logging instead of sending`);
      console.log(`[email:dev] To: ${to} | ${subject}`);
      for (const l of links) console.log(`[email:dev]   link: ${l}`);
      return;
    }
    const info = await tx.sendMail({ from, to, subject, html });
    console.log(`[email] SENT "${subject}" -> ${to} (${info.messageId}) ${info.response ?? ''}`);
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
  const itemsHtml = (order.items ?? [])
    .map((i) => `<li>${i.productTitle} × ${i.quantity} — ${fmtPKR(toNum(i.price as never) * i.quantity)}</li>`)
    .join('');
  const storefrontUrl = (process.env.STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const orderUrl = opts.guestToken
    ? `${storefrontUrl}/order-confirmation/${order.id}?token=${opts.guestToken}`
    : `${storefrontUrl}/account/orders`;
  const linkLabel = opts.guestToken ? 'View your order' : 'View your orders';
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2>Thank you for your order, ${to.name.split(' ')[0]}!</h2>
      <p>Your order <strong>${order.orderNumber}</strong> has been placed.</p>
      <ul>${itemsHtml}</ul>
      <p><strong>Total: ${total}</strong> — Payment: ${order.paymentMethod}</p>
      <p><a href="${orderUrl}">${linkLabel}</a></p>
      ${opts.guestToken ? '<p style="color:#666;font-size:13px">Keep this email — the link above is how you check your order status.</p>' : ''}
      <p>We'll notify you as your order progresses. Thank you for shopping with Aabroo.</p>
    </div>`;

  // Fire-and-forget across channels.
  void Promise.allSettled([
    sendEmail(to.email, `Order ${order.orderNumber} confirmed`, html),
    sendWhatsApp(to.phone, [to.name.split(' ')[0], order.orderNumber, total]),
  ]);
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
  const rows = orders
    .filter((o) => o.guestToken)
    .map(
      (o) =>
        `<li><a href="${storefrontUrl}/order-confirmation/${o.id}?token=${o.guestToken}">${o.orderNumber}</a>` +
        ` — ${new Date(o.createdAt).toLocaleDateString('en-PK')}</li>`,
    )
    .join('');

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2>Your orders at Aabroo</h2>
      <p>Here are the orders placed with this email address:</p>
      <ul>${rows}</ul>
      <p style="color:#666;font-size:13px">If you didn't request this, you can ignore this email.</p>
    </div>`;

  void sendEmail(email, 'Your Aabroo orders', html);
}

/**
 * Sends the password-reset link.
 *
 * Uses the same sendEmail() as everything else, so it needs no special handling
 * before SMTP exists: with SMTP_HOST unset the link is printed to the server log
 * (usable straight away), and the moment SMTP_HOST is set it starts being
 * delivered for real — no code change.
 */
export function notifyPasswordReset(email: string, name: string, token: string): void {
  const storefrontUrl = (process.env.STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const link = `${storefrontUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2>Reset your password</h2>
      <p>Hi ${name.split(' ')[0]}, we received a request to reset the password on your Aabroo account.</p>
      <p style="margin:22px 0">
        <a href="${link}" style="display:inline-block;background:#B4530A;color:#ffffff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:600">Choose a new password</a>
      </p>
      <p style="color:#666;font-size:13px">Or paste this into your browser:<br><span style="word-break:break-all">${link}</span></p>
      <p style="color:#666;font-size:13px">This link expires in 1 hour and can only be used once.</p>
      <p style="color:#666;font-size:13px">If you didn't request this, you can ignore this email — your password won't change.</p>
    </div>`;

  void sendEmail(email, 'Reset your Aabroo password', html);
}

export function notifyOrderStatus(order: OrderLike, to: Recipient): void {
  const label = STATUS_LABEL[order.status] ?? order.status;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2>Order ${order.orderNumber} update</h2>
      <p>Hi ${to.name.split(' ')[0]}, your order is now <strong>${label.toUpperCase()}</strong>.</p>
      <p>Thank you for shopping with Aabroo.</p>
    </div>`;

  void Promise.allSettled([
    sendEmail(to.email, `Order ${order.orderNumber} is ${label}`, html),
    sendWhatsApp(to.phone, [to.name.split(' ')[0], order.orderNumber, label]),
  ]);
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
): Promise<{ ok: boolean; messageId?: string; response?: string; error?: string; code?: string }> {
  try {
    const tx = getTransporter();
    if (!tx) return { ok: false, error: 'SMTP_HOST is not set on this server' };
    const info = await tx.sendMail({
      from: process.env.EMAIL_FROM ?? 'orders@store.pk',
      to,
      subject: 'Aabroo — test email',
      html: '<h2>It works</h2><p>Your store can send email. Sent from the admin diagnostics endpoint.</p>',
    });
    return { ok: true, messageId: info.messageId, response: info.response };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error).message,
      code: (err as NodeJS.ErrnoException).code,
    };
  }
}
