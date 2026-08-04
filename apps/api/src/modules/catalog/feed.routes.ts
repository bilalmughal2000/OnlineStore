import { Router } from 'express';
import { prisma, ProductStatus } from '@store/database';
import { asyncHandler } from '../../lib/asyncHandler';
import { cached } from '../../lib/cache';
import { toNum } from '../../lib/money';

/**
 * Product catalogue feed (RSS 2.0 + Google's `g:` namespace).
 *
 * Consumed by Meta Commerce Manager to power Advantage+ catalogue ads, dynamic
 * retargeting and Instagram Shopping. Google Merchant Center accepts the same
 * format, so one feed serves both.
 *
 * ── The one rule that must not be broken ────────────────────────────────────
 * `g:id` MUST equal the `content_ids` the Pixel and Conversions API send for a
 * product. Both send the **Product** cuid (never the variant id) — see
 * apps/storefront/src/lib/analytics.ts and lib/meta-capi.ts. If this feed ever
 * becomes variant-level, those ids stop matching and retargeting silently
 * attributes nothing: no error, no warning, just zero sales credited.
 *
 * That is why this feed is deliberately product-level. Size and colour are only
 * emitted when a product has exactly one distinct value, since a product-level
 * row cannot honestly claim a single size when it stocks five.
 */
export const feedRouter = Router();

const FEED_TTL_SECONDS = 600;

// Google/Meta limits: title 150 chars, description 5000.
const MAX_TITLE = 150;
const MAX_DESCRIPTION = 5000;
const MAX_ADDITIONAL_IMAGES = 10;

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );

/** Descriptions are rich text; feeds require plain text. */
const plainText = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    // Decode the entities the editor commonly emits, so shoppers don't see &amp;.
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

const tag = (name: string, value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '' : `      <${name}>${escapeXml(String(value))}</${name}>\n`;

// Feeds want an absolute price with the currency code: "1899.00 PKR".
const money = (n: number) => `${n.toFixed(2)} PKR`;

feedRouter.get(
  '/products.xml',
  asyncHandler(async (_req, res) => {
    const { xml } = await cached(`feed:products:v1`, FEED_TTL_SECONDS, async () => {
      const storefrontUrl = (process.env.STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '');

      const [products, storeSetting] = await Promise.all([
        prisma.product.findMany({
          where: { status: ProductStatus.PUBLISHED },
          include: {
            images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
            variants: true,
            category: { include: { parent: { select: { name: true } } } },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.setting.findUnique({ where: { key: 'store' } }),
      ]);

      const storeName = ((storeSetting?.value as Record<string, unknown>)?.name as string) ?? 'Aabroo';

      let skippedNoImage = 0;
      const items: string[] = [];

      for (const p of products) {
        // Meta rejects any item without an image_link, so skipping is strictly
        // better than submitting a row that will be disapproved.
        const primary = p.images[0];
        if (!primary) {
          skippedNoImage++;
          continue;
        }

        const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
        // No variants means there is nothing that can actually be bought.
        const inStock = p.variants.length > 0 && totalStock > 0;

        const base = toNum(p.basePrice);
        const sale = p.salePrice != null ? toNum(p.salePrice) : null;
        const hasDiscount = sale != null && sale < base;

        const sizes = [...new Set(p.variants.map((v) => v.size).filter(Boolean))] as string[];
        const colors = [...new Set(p.variants.map((v) => v.color).filter(Boolean))] as string[];

        const categoryPath = p.category
          ? [p.category.parent?.name, p.category.name].filter(Boolean).join(' > ')
          : null;

        const description = plainText(p.description) || p.title;

        items.push(
          '    <item>\n' +
            // ── identity — must match the Pixel's content_ids ──
            tag('g:id', p.id) +
            tag('g:title', truncate(p.title, MAX_TITLE)) +
            tag('g:description', truncate(description, MAX_DESCRIPTION)) +
            tag('g:link', `${storefrontUrl}/product/${p.slug}`) +
            tag('g:image_link', primary.url) +
            p.images
              .slice(1, 1 + MAX_ADDITIONAL_IMAGES)
              .map((im) => tag('g:additional_image_link', im.url))
              .join('') +
            // ── availability & price ──
            tag('g:availability', inStock ? 'in stock' : 'out of stock') +
            tag('g:condition', 'new') +
            // When discounted, `price` must stay the original and `sale_price`
            // carry the reduced one — that's what renders a strikethrough.
            tag('g:price', money(base)) +
            (hasDiscount ? tag('g:sale_price', money(sale!)) : '') +
            tag('g:quantity_to_sell_on_facebook', totalStock) +
            // ── apparel attributes ──
            // Brand is effectively required for clothing; fall back to the store.
            tag('g:brand', p.brand || storeName) +
            tag('g:mpn', p.sku) +
            tag('g:material', p.fabric) +
            tag('g:gender', p.gender ? p.gender.toLowerCase() : null) +
            tag('g:age_group', p.ageGroup ? p.ageGroup.toLowerCase() : null) +
            tag('g:google_product_category', p.googleProductCategory) +
            tag('g:product_type', categoryPath) +
            // Only when unambiguous — see the header comment.
            (sizes.length === 1 ? tag('g:size', sizes[0]) : '') +
            (colors.length === 1 ? tag('g:color', colors[0]) : '') +
            // Handy for segmenting campaigns inside Ads Manager.
            tag('g:custom_label_0', categoryPath) +
            tag('g:custom_label_1', hasDiscount ? 'on-sale' : 'full-price') +
            '    </item>\n',
        );
      }

      const xml =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n' +
        '  <channel>\n' +
        tag('title', `${storeName} — Product Feed`).replace(/^ {6}/, '    ') +
        `    <link>${escapeXml(storefrontUrl)}</link>\n` +
        '    <description>Product catalogue for Meta / Google Shopping</description>\n' +
        `    <!-- ${items.length} items` +
        (skippedNoImage ? `; ${skippedNoImage} published product(s) skipped for having no image` : '') +
        ' -->\n' +
        items.join('') +
        '  </channel>\n' +
        '</rss>\n';

      if (skippedNoImage > 0) {
        console.warn(`[feed] ${skippedNoImage} published product(s) skipped — no image, would be rejected by Meta`);
      }

      return { xml };
    });

    res
      .type('application/xml; charset=utf-8')
      .set('Cache-Control', `public, max-age=${FEED_TTL_SECONDS}, s-maxage=${FEED_TTL_SECONDS}`)
      .send(xml);
  }),
);
