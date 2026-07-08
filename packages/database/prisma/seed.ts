import { config } from 'dotenv';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  ProductStatus,
  Role,
  SectionType,
  CouponType,
} from '@prisma/client';

// Load root .env so DATABASE_URL is available when seeding.
config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Deterministic placeholder image URLs (picsum) so the UI has real images.
const img = (seed: string, w = 800, h = 1000) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

async function main() {
  console.log('🌱 Seeding database...');

  // ── Clean (idempotent dev seed) ──────────────────────────────
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.orderStatusLog.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.wishlistItem.deleteMany(),
    prisma.review.deleteMany(),
    prisma.productAttribute.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.product.deleteMany(),
    prisma.attributeValue.deleteMany(),
    prisma.attribute.deleteMany(),
    prisma.category.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.homepageSection.deleteMany(),
    prisma.banner.deleteMany(),
    prisma.menuItem.deleteMany(),
    prisma.staticPage.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.address.deleteMany(),
    prisma.adminActivityLog.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // ── Admin + demo customer ────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@store.pk';
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';

  const admin = await prisma.user.create({
    data: {
      name: 'Store Owner',
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPass, 10),
      role: Role.ADMIN,
      phone: '+923000000000',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Ayesha Khan',
      email: 'customer@store.pk',
      passwordHash: await bcrypt.hash('customer12345', 10),
      role: Role.CUSTOMER,
      phone: '+923111111111',
    },
  });

  // ── Categories ───────────────────────────────────────────────
  const catData = [
    { name: 'Women', children: ['Kurtis', 'Sarees', 'Lawn Suits'] },
    { name: 'Men', children: ['Shirts', 'Kurtas', 'Trousers'] },
    { name: 'Kids', children: ['Girls', 'Boys'] },
    { name: 'Accessories', children: ['Bags', 'Jewellery'] },
    { name: 'Sale', children: [] },
  ];

  const categoryMap = new Map<string, string>();
  let catSort = 0;
  for (const c of catData) {
    const parent = await prisma.category.create({
      data: {
        name: c.name,
        slug: slugify(c.name),
        image: img(`cat-${c.name}`, 600, 700),
        sortOrder: catSort++,
      },
    });
    categoryMap.set(c.name, parent.id);
    let childSort = 0;
    for (const child of c.children) {
      const sub = await prisma.category.create({
        data: {
          name: child,
          slug: slugify(`${c.name}-${child}`),
          parentId: parent.id,
          sortOrder: childSort++,
        },
      });
      categoryMap.set(`${c.name}/${child}`, sub.id);
    }
  }

  // ── Attributes ───────────────────────────────────────────────
  const fabric = await prisma.attribute.create({
    data: {
      name: 'Fabric',
      values: {
        create: [
          { value: 'Cotton' },
          { value: 'Lawn' },
          { value: 'Linen' },
          { value: 'Chiffon' },
        ],
      },
    },
    include: { values: true },
  });

  await prisma.attribute.create({
    data: {
      name: 'Occasion',
      values: { create: [{ value: 'Casual' }, { value: 'Formal' }, { value: 'Party' }] },
    },
  });

  // ── Products ─────────────────────────────────────────────────
  const sizes = ['S', 'M', 'L', 'XL'];
  const colors = [
    { name: 'Black', hex: '#111111' },
    { name: 'Maroon', hex: '#800020' },
    { name: 'Teal', hex: '#0d9488' },
    { name: 'Beige', hex: '#d6c7a1' },
  ];

  const productDefs = [
    { title: 'Embroidered Lawn Kurti', cat: 'Women/Kurtis', base: 3499, sale: 2799, brand: 'Aabroo', featured: true },
    { title: 'Printed Chiffon Saree', cat: 'Women/Sarees', base: 8999, sale: null, brand: 'Aabroo', featured: true },
    { title: '3-Piece Lawn Suit', cat: 'Women/Lawn Suits', base: 5499, sale: 4299, brand: 'Aabroo', featured: true },
    { title: 'Classic Formal Shirt', cat: 'Men/Shirts', base: 2999, sale: 2299, brand: 'Adeel', featured: true },
    { title: 'Cotton Kurta', cat: 'Men/Kurtas', base: 3999, sale: null, brand: 'Adeel', featured: false },
    { title: 'Slim-Fit Trousers', cat: 'Men/Trousers', base: 3499, sale: 2799, brand: 'Adeel', featured: false },
    { title: 'Girls Frock', cat: 'Kids/Girls', base: 1999, sale: 1499, brand: 'TinyTots', featured: true },
    { title: 'Boys Kurta Shalwar', cat: 'Kids/Boys', base: 2499, sale: null, brand: 'TinyTots', featured: false },
    { title: 'Leather Tote Bag', cat: 'Accessories/Bags', base: 4999, sale: 3999, brand: 'Carry', featured: true },
    { title: 'Kundan Earrings', cat: 'Accessories/Jewellery', base: 1299, sale: null, brand: 'Zevar', featured: false },
    { title: 'Summer Linen Kurti', cat: 'Women/Kurtis', base: 2999, sale: 1999, brand: 'Aabroo', featured: false },
    { title: 'Casual Cotton Shirt', cat: 'Men/Shirts', base: 2499, sale: 1899, brand: 'Adeel', featured: false },
  ];

  const createdProducts: { id: string; slug: string }[] = [];

  for (const [i, p] of productDefs.entries()) {
    const slug = slugify(p.title);
    const product = await prisma.product.create({
      data: {
        title: p.title,
        slug,
        description: `${p.title} — premium quality, tailored for the Pakistani market. Breathable fabric, modern cut, and vibrant colours. Perfect for everyday wear and special occasions.`,
        basePrice: p.base,
        salePrice: p.sale ?? undefined,
        costPrice: Math.round(p.base * 0.6),
        sku: `SKU-${1000 + i}`,
        status: ProductStatus.PUBLISHED,
        isFeatured: p.featured,
        brand: p.brand,
        fabric: 'Lawn',
        categoryId: categoryMap.get(p.cat),
        seoTitle: p.title,
        seoDescription: `Buy ${p.title} online in Pakistan. Cash on Delivery available.`,
        // Every product ships with a default size chart table (measurements in inches).
        sizeChartTable: {
          headers: ['Size', 'Chest', 'Waist', 'Length'],
          rows: [
            ['S', '36', '30', '26'],
            ['M', '38', '32', '27'],
            ['L', '40', '34', '28'],
            ['XL', '42', '36', '29'],
          ],
        },
        ratingAvg: 4 + (i % 2) * 0.5,
        ratingCount: 5 + i,
        images: {
          create: [
            { url: img(`${slug}-1`), alt: p.title, isPrimary: true, sortOrder: 0 },
            { url: img(`${slug}-2`), alt: p.title, sortOrder: 1 },
            { url: img(`${slug}-3`), alt: p.title, sortOrder: 2 },
          ],
        },
        attributes: {
          create: [{ attributeValueId: fabric.values[i % fabric.values.length].id }],
        },
        variants: {
          create: sizes.flatMap((size, si) =>
            colors.slice(0, 2).map((color) => ({
              size,
              color: color.name,
              colorHex: color.hex,
              sku: `SKU-${1000 + i}-${size}-${color.name.slice(0, 2).toUpperCase()}`,
              stock: (si + 1) * 5,
            })),
          ),
        },
      },
    });
    createdProducts.push({ id: product.id, slug: product.slug });
  }

  // ── Homepage sections ────────────────────────────────────────
  await prisma.homepageSection.createMany({
    data: [
      {
        title: 'New Arrivals',
        type: SectionType.PRODUCT_GRID,
        sortOrder: 1,
        config: { filter: 'newest', limit: 8 },
      },
      {
        title: 'Best Sellers',
        type: SectionType.PRODUCT_GRID,
        sortOrder: 2,
        config: { filter: 'featured', limit: 8 },
      },
      {
        title: 'Shop by Category',
        type: SectionType.CATEGORY_TILES,
        sortOrder: 3,
        config: {},
      },
    ],
  });

  // ── Banners ──────────────────────────────────────────────────
  await prisma.banner.createMany({
    data: [
      {
        title: 'Summer Lawn Collection',
        imageUrl: img('banner-summer', 1600, 600),
        link: '/category/women',
        position: 'hero',
        sortOrder: 0,
      },
      {
        title: 'Eid Sale — Up to 50% Off',
        imageUrl: img('banner-eid', 1600, 600),
        link: '/category/sale',
        position: 'hero',
        sortOrder: 1,
      },
      {
        title: 'Free delivery on orders above Rs. 3000',
        imageUrl: img('strip', 1600, 120),
        position: 'strip',
        sortOrder: 0,
      },
    ],
  });

  // ── Menu ─────────────────────────────────────────────────────
  const menuTop = ['Women', 'Men', 'Kids', 'Accessories', 'Sale'];
  for (const [i, label] of menuTop.entries()) {
    await prisma.menuItem.create({
      data: { label, url: `/category/${slugify(label)}`, location: 'header', sortOrder: i },
    });
  }
  for (const [i, label] of ['About Us', 'Contact', 'Shipping Policy', 'Returns', 'Privacy Policy'].entries()) {
    await prisma.menuItem.create({
      data: { label, url: `/page/${slugify(label)}`, location: 'footer', sortOrder: i },
    });
  }

  // ── Static pages ─────────────────────────────────────────────
  const pages = [
    ['about-us', 'About Us', 'We are a modern Pakistani clothing brand delivering quality fashion nationwide.'],
    ['contact', 'Contact Us', 'Reach us at support@store.pk or call +92 300 0000000.'],
    ['shipping-policy', 'Shipping & Delivery Policy', 'We deliver across Pakistan within 3-5 working days.'],
    ['returns', 'Return & Exchange Policy', 'Easy 7-day returns on unused items with tags intact.'],
    ['privacy-policy', 'Privacy Policy', 'We respect your privacy and never sell your data.'],
    ['faqs', 'FAQs', 'Frequently asked questions about orders, payments, and delivery.'],
  ];
  for (const [slug, title, content] of pages) {
    await prisma.staticPage.create({ data: { slug, title, content } });
  }

  // ── Coupons ──────────────────────────────────────────────────
  await prisma.coupon.createMany({
    data: [
      { code: 'EID10', type: CouponType.PERCENTAGE, value: 10, minOrderValue: 2000, usageLimit: 1000, perUserLimit: 1 },
      { code: 'FLAT500', type: CouponType.FIXED, value: 500, minOrderValue: 5000 },
    ],
  });

  // ── Settings ─────────────────────────────────────────────────
  await prisma.setting.createMany({
    data: [
      { key: 'store', value: { name: 'Aabroo', currency: 'PKR', tagline: 'Modern Pakistani Fashion' } },
      { key: 'shipping', value: { flatRate: 200, freeShippingThreshold: 3000 } },
      { key: 'payments', value: { cod: true, stripe: false, jazzcash: false, easypaisa: false, codMaxValue: 20000 } },
      { key: 'tax', value: { enabled: false, rate: 0 } },
    ],
  });

  console.log(`✅ Seed complete.
  Admin login: ${adminEmail} / ${adminPass}
  Customer login: customer@store.pk / customer12345
  Products: ${createdProducts.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
