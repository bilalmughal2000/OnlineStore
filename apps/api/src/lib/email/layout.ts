/**
 * Branded shell every outgoing email is wrapped in.
 *
 * HTML email is not the web. Gmail strips <style> blocks, Outlook renders with
 * Word's engine (no flexbox, no grid, unreliable padding on divs), and Apple
 * Mail respects almost nothing consistently. So this is deliberately built the
 * way email has to be built:
 *   - tables for layout, not divs
 *   - inline styles only, no classes or <style> block
 *   - explicit widths in px, capped at 600 (the safe universal width)
 *   - background colours on <td>, since Outlook ignores them on containers
 *   - buttons as bordered table cells, because <a> padding collapses in Outlook
 *
 * Anything fancier looks fine in Gmail's web preview and falls apart for the
 * significant share of customers reading on Outlook.
 */

export interface EmailBranding {
  storeName: string;
  /** Accent colour (buttons, headings). Falls back to the store's terracotta. */
  accentColor: string;
  logoUrl?: string | null;
  /** Optional banner across the top — a still image or an animated GIF. */
  headerImageUrl?: string | null;
  footerText?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  storefrontUrl: string;
}

export const DEFAULT_BRANDING: Omit<EmailBranding, 'storefrontUrl'> = {
  storeName: 'Aabroo',
  accentColor: '#B4530A',
  logoUrl: null,
  headerImageUrl: null,
  footerText: null,
  supportEmail: null,
  supportPhone: null,
};

const escape = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

/** Wraps template body HTML in the branded shell. */
export function renderEmailLayout(
  bodyHtml: string,
  branding: EmailBranding,
  opts: { preheader?: string } = {},
): string {
  const { storeName, accentColor, logoUrl, headerImageUrl, footerText, supportEmail, supportPhone, storefrontUrl } =
    branding;

  const header = logoUrl
    ? `<img src="${escape(logoUrl)}" alt="${escape(storeName)}" width="150" style="display:block;border:0;max-width:150px;height:auto;margin:0 auto">`
    : `<a href="${escape(storefrontUrl)}" style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#1c1917;text-decoration:none;letter-spacing:-0.5px">${escape(storeName)}</a>`;

  const banner = headerImageUrl
    ? `<tr><td style="padding:0"><img src="${escape(headerImageUrl)}" alt="" width="600" style="display:block;border:0;width:100%;max-width:600px;height:auto"></td></tr>`
    : '';

  const support = [
    supportEmail ? `<a href="mailto:${escape(supportEmail)}" style="color:#78716c;text-decoration:underline">${escape(supportEmail)}</a>` : '',
    supportPhone ? `<a href="tel:${escape(supportPhone.replace(/\s/g, ''))}" style="color:#78716c;text-decoration:underline">${escape(supportPhone)}</a>` : '',
  ]
    .filter(Boolean)
    .join(' &nbsp;·&nbsp; ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escape(storeName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;-webkit-font-smoothing:antialiased">
<!-- Preheader: the grey preview line next to the subject in most inboxes.
     Hidden in the body itself, then padded so no other content leaks into it. -->
<div style="display:none;font-size:1px;color:#f5f5f4;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
  ${escape(opts.preheader ?? '')}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5f5f4">
  <tr>
    <td align="center" style="padding:28px 12px">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">

        <!-- Header -->
        <tr>
          <td align="center" style="padding:30px 32px 22px 32px;border-bottom:1px solid #f0efed">
            ${header}
          </td>
        </tr>
        ${banner}

        <!-- Body -->
        <tr>
          <td style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#292524">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:22px 32px 28px 32px;background-color:#fafaf9;border-top:1px solid #f0efed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#78716c" align="center">
            ${footerText ? `<p style="margin:0 0 10px 0;color:#57534e">${escape(footerText)}</p>` : ''}
            ${support ? `<p style="margin:0 0 10px 0">${support}</p>` : ''}
            <p style="margin:0">
              <a href="${escape(storefrontUrl)}" style="color:${escape(accentColor)};text-decoration:none;font-weight:600">Visit ${escape(storeName)}</a>
            </p>
            <p style="margin:10px 0 0 0;color:#a8a29e">© ${new Date().getFullYear()} ${escape(storeName)}. All rights reserved.</p>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * Call-to-action button.
 *
 * Built from a table because <a> padding is unreliable in Outlook — the
 * clickable area collapses to the text and the shape disappears.
 */
export function emailButton(label: string, href: string, accentColor: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0">
  <tr>
    <td align="center" bgcolor="${escape(accentColor)}" style="border-radius:8px">
      <a href="${escape(href)}" style="display:inline-block;padding:13px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${escape(label)}</a>
    </td>
  </tr>
</table>`;
}
