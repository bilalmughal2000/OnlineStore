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
    });
  }
  return transporter;
}

async function sendEmail(to: string | null, subject: string, html: string): Promise<void> {
  if (!to) return;
  const from = process.env.EMAIL_FROM ?? 'orders@store.pk';
  const tx = getTransporter();
  if (!tx) {
    console.log(`[email:dev] To: ${to} | ${subject}`);
    return;
  }
  try {
    await tx.sendMail({ from, to, subject, html });
  } catch (err) {
    console.error('[email] send failed:', (err as Error).message);
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

export function notifyOrderPlaced(order: OrderLike, to: Recipient): void {
  const total = fmtPKR(toNum(order.total as never));
  const itemsHtml = (order.items ?? [])
    .map((i) => `<li>${i.productTitle} × ${i.quantity} — ${fmtPKR(toNum(i.price as never) * i.quantity)}</li>`)
    .join('');
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2>Thank you for your order, ${to.name.split(' ')[0]}!</h2>
      <p>Your order <strong>${order.orderNumber}</strong> has been placed.</p>
      <ul>${itemsHtml}</ul>
      <p><strong>Total: ${total}</strong> — Payment: ${order.paymentMethod}</p>
      <p>We'll notify you as your order progresses. Thank you for shopping with Aabroo.</p>
    </div>`;

  // Fire-and-forget across channels.
  void Promise.allSettled([
    sendEmail(to.email, `Order ${order.orderNumber} confirmed`, html),
    sendWhatsApp(to.phone, [to.name.split(' ')[0], order.orderNumber, total]),
  ]);
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
