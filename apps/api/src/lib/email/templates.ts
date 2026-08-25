/**
 * Default content for every email the store sends.
 *
 * These are the fallback used whenever the admin hasn't saved a custom version
 * (or has disabled theirs). They contain only the *body* — the branded shell,
 * colours and footer come from renderEmailLayout(), so a template stays on
 * brand even if someone edits it heavily.
 *
 * `{{placeholders}}` are substituted at send time. Anything the admin can edit
 * is listed in `variables` so the editor can show what's available; a typo in a
 * placeholder renders as empty rather than breaking the email.
 */

export type EmailTemplateKey =
  | 'ORDER_PLACED'
  | 'ORDER_STATUS'
  | 'PASSWORD_RESET'
  | 'ORDER_LINKS'
  | 'LOW_STOCK';

export interface EmailTemplateDef {
  key: EmailTemplateKey;
  name: string;
  description: string;
  subject: string;
  /** Body HTML. Wrapped by the branded layout at send time. */
  html: string;
  /** Placeholder name → what it means, shown in the admin editor. */
  variables: Record<string, string>;
  /** Realistic values, used for preview and test sends. */
  sample: Record<string, string>;
}

const BTN = '{{ctaButton}}';

export const EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplateDef> = {
  ORDER_PLACED: {
    key: 'ORDER_PLACED',
    name: 'Order confirmation',
    description: 'Sent the moment an order is placed.',
    subject: 'Order {{orderNumber}} confirmed 🎉',
    html: `<p style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#1c1917">Thank you, {{firstName}}!</p>
<p style="margin:0 0 22px 0;color:#57534e">Your order is confirmed and we've started getting it ready.</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafaf9;border-radius:10px;margin-bottom:22px">
  <tr>
    <td style="padding:16px 18px">
      <span style="font-size:12px;text-transform:uppercase;letter-spacing:0.6px;color:#78716c">Order number</span><br>
      <span style="font-size:18px;font-weight:700;color:#1c1917">{{orderNumber}}</span>
    </td>
    <td align="right" style="padding:16px 18px">
      <span style="font-size:12px;text-transform:uppercase;letter-spacing:0.6px;color:#78716c">Total</span><br>
      <span style="font-size:18px;font-weight:700;color:#1c1917">{{orderTotal}}</span>
    </td>
  </tr>
</table>

{{itemsTable}}

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;border-top:1px solid #f0efed">
  <tr><td style="padding:14px 0 0 0;color:#57534e">Payment</td><td align="right" style="padding:14px 0 0 0;font-weight:600;color:#1c1917">{{paymentMethod}}</td></tr>
</table>

${BTN}

<p style="margin:0;color:#78716c;font-size:13px">We'll email you again as soon as your order ships.</p>`,
    variables: {
      firstName: "Customer's first name",
      customerName: 'Full name',
      orderNumber: 'e.g. PK12345678001',
      orderTotal: 'Formatted total, e.g. Rs 2,099',
      itemsTable: 'The ordered items, as a formatted table',
      paymentMethod: 'COD, Card, etc.',
      orderUrl: 'Link to view the order',
      ctaButton: 'The "View your order" button',
      storeName: 'Your store name',
    },
    sample: {
      firstName: 'Ayesha',
      customerName: 'Ayesha Khan',
      orderNumber: 'PK12345678001',
      orderTotal: 'Rs 2,099',
      paymentMethod: 'COD',
      storeName: 'Aabroo',
    },
  },

  ORDER_STATUS: {
    key: 'ORDER_STATUS',
    name: 'Order status update',
    description: 'Sent when you change an order’s status in the admin.',
    subject: 'Your order {{orderNumber}} is {{statusLabel}}',
    html: `<p style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#1c1917">Hi {{firstName}},</p>
<p style="margin:0 0 22px 0;color:#57534e">There's an update on your order.</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafaf9;border-radius:10px;margin-bottom:8px">
  <tr>
    <td align="center" style="padding:24px 18px">
      <span style="font-size:12px;text-transform:uppercase;letter-spacing:0.6px;color:#78716c">Order {{orderNumber}} is now</span><br>
      <span style="font-size:24px;font-weight:700;color:#1c1917;text-transform:uppercase;letter-spacing:0.5px">{{statusLabel}}</span>
    </td>
  </tr>
</table>

${BTN}

<p style="margin:0;color:#78716c;font-size:13px">Questions about this order? Just reply to this email.</p>`,
    variables: {
      firstName: "Customer's first name",
      orderNumber: 'e.g. PK12345678001',
      statusLabel: 'shipped, delivered, cancelled …',
      orderUrl: 'Link to view the order',
      ctaButton: 'The "Track your order" button',
      storeName: 'Your store name',
    },
    sample: { firstName: 'Ayesha', orderNumber: 'PK12345678001', statusLabel: 'shipped', storeName: 'Aabroo' },
  },

  PASSWORD_RESET: {
    key: 'PASSWORD_RESET',
    name: 'Password reset',
    description: 'Sent when someone asks to reset their password.',
    subject: 'Reset your {{storeName}} password',
    html: `<p style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#1c1917">Reset your password</p>
<p style="margin:0 0 20px 0;color:#57534e">Hi {{firstName}}, we received a request to reset the password on your {{storeName}} account.</p>

${BTN}

<p style="margin:0 0 14px 0;color:#78716c;font-size:13px">This link expires in 1 hour and can only be used once.</p>
<p style="margin:0;color:#78716c;font-size:13px">If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
    variables: {
      firstName: "Customer's first name",
      resetUrl: 'The password reset link',
      ctaButton: 'The "Choose a new password" button',
      storeName: 'Your store name',
    },
    sample: { firstName: 'Ayesha', storeName: 'Aabroo' },
  },

  ORDER_LINKS: {
    key: 'ORDER_LINKS',
    name: 'Find my orders',
    description: 'Sent when a guest asks for links to their past orders.',
    subject: 'Your {{storeName}} orders',
    html: `<p style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#1c1917">Your orders</p>
<p style="margin:0 0 20px 0;color:#57534e">Here are the orders placed with this email address. Use the links below to check on any of them.</p>

{{ordersList}}

<p style="margin:22px 0 0 0;color:#78716c;font-size:13px">If you didn't request this, you can ignore this email.</p>`,
    variables: {
      ordersList: 'The list of orders, with a link for each',
      storeName: 'Your store name',
    },
    sample: { storeName: 'Aabroo' },
  },

  LOW_STOCK: {
    key: 'LOW_STOCK',
    name: 'Low stock alert',
    description: 'Sent to you (not the customer) when an item runs low or sells out.',
    subject: '{{alertTitle}} — {{itemCount}} item(s) need restocking',
    html: `<p style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#1c1917">{{alertTitle}}</p>
<p style="margin:0 0 22px 0;color:#57534e">These items just dropped to or below your alert level. Restock them before they cost you sales.</p>

{{itemsTable}}

${BTN}

<p style="margin:22px 0 0 0;color:#78716c;font-size:13px">You're getting this because low-stock alerts are on. Turn them off or change the level in Settings &rsaquo; Inventory.</p>`,
    variables: {
      alertTitle: 'e.g. "Sold out" or "Running low"',
      itemsTable: 'The table of items and how many are left',
      itemCount: 'How many items are in this alert',
      ctaButton: 'The "Open products" button',
      storeName: 'Your store name',
    },
    sample: {
      alertTitle: 'Running low',
      itemCount: '2',
      itemsTable:
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:8px">' +
        '<tr><td style="padding:10px 0;border-bottom:1px solid #e7e5e4;color:#1c1917">Summer Linen Kurti — M / Red</td>' +
        '<td align="right" style="padding:10px 0;border-bottom:1px solid #e7e5e4;font-weight:700;color:#b45309">2 left</td></tr>' +
        '<tr><td style="padding:10px 0;color:#1c1917">3-Piece Lawn Suit — L / Blue</td>' +
        '<td align="right" style="padding:10px 0;font-weight:700;color:#dc2626">Sold out</td></tr></table>',
      storeName: 'Aabroo',
    },
  },

};

export const TEMPLATE_KEYS = Object.keys(EMAIL_TEMPLATES) as EmailTemplateKey[];
