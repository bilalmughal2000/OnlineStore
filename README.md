# Online Clothing Store — Full-Stack E-commerce (Pakistan Market)

A modern, mobile-first online clothing store built for the Pakistani market: storefront, admin panel, and API in a single monorepo. Supports browsing, cart, COD checkout, order tracking, coupons, a dynamic homepage builder, and a full admin panel — with Stripe/JazzCash/EasyPaisa wired as clearly-marked integration points (Phase 4).

## Stack

| Layer | Tech |
|---|---|
| Storefront | Next.js 14 (App Router, SSR/SEO) · Tailwind · TypeScript |
| Admin panel | React 18 + Vite SPA · React Router · Recharts · Tailwind |
| API | Express + TypeScript · Prisma · MySQL · Redis · JWT |
| Shared | `@store/database` (Prisma), `@store/shared-types` (Zod schemas) |
| Tooling | npm workspaces · Docker Compose (MySQL + Redis) |

## Monorepo layout

```
apps/
  storefront/   Next.js customer storefront   (localhost:3000)
  admin/        React SPA admin panel         (localhost:5173)
  api/          Express REST API              (localhost:4000)
packages/
  database/     Prisma schema, client, seed
  shared-types/ Shared Zod schemas + TS types
```

## Prerequisites

- Node.js 20+
- Docker (for local MySQL + Redis) — or point `DATABASE_URL`/`REDIS_URL` at managed instances

## Quick start

```bash
# 1. Environment
cp .env.example .env          # already done if .env exists

# 2. Start MySQL + Redis (Docker). Ports: MySQL 3307, Redis 6380.
npm run db:up

# 3. Install, build shared package, migrate schema, seed demo data
npm run setup                 # = install + build shared-types + migrate + seed
```

Then run the three apps (each in its own terminal):

```bash
npm run dev:api          # http://localhost:4000  (docs at /docs)
npm run dev:storefront   # http://localhost:3000
npm run dev:admin        # http://localhost:5173
```

### Demo logins (from the seed)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@store.pk` | `admin12345` |
| Customer | `customer@store.pk` | `customer12345` |

## What's implemented

**Storefront** — dynamic homepage (hero carousel + admin-built sections + category tiles), category listings with filters/sort/pagination, product detail (gallery, variant/size/color selection, stock indicator, tabs, related products, schema.org markup), search, guest + user cart (server-priced), coupons, COD checkout, order confirmation, auth (register/login/refresh), account (orders, wishlist, addresses, profile), static pages.

**Admin** — dashboard (revenue chart, payment breakdown, KPIs, top products, low stock), product CRUD with variants/images/SEO + bulk actions, category management, order management (status timeline, payment reconciliation, invoice print), coupons, drag-order homepage section builder, customers (block/unblock, LTV), review moderation, store settings (shipping, payments, COD limit).

**API** — JWT auth (access + rotating refresh, bcrypt), RBAC (server-enforced), catalog, cart with authoritative server-side pricing, orders with atomic stock decrement, coupons with usage limits, content/CMS, admin modules, rate limiting on auth/checkout, Swagger docs at `/docs`.

## Payment gateways (Phase 4)

COD is fully working. Stripe / JazzCash / EasyPaisa are structured as integration points:
- Order + `Payment` records are created with `PENDING` status.
- `apps/api/src/modules/orders/orders.routes.ts` has `TODO(Phase 4)` markers where gateway session initiation and webhook confirmation belong.
- Credentials live in `.env` (see placeholders). See the spec's Section 6 for per-gateway flow.

> **Stripe note:** Stripe does not natively support PKR payouts for PK-registered merchants — confirm business/entity eligibility before building (spec §6.4, §11.2).

## Order notifications (email + WhatsApp)

Order **placed** and **status-change** events notify the customer via two
independent, best-effort channels (`apps/api/src/lib/notify.ts`):

- **Email — SMTP.** Set `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`EMAIL_FROM`
  in `.env` (e.g. your hosting provider's mailbox). If `SMTP_HOST` is blank, emails
  are logged to the console (handy in dev).
- **WhatsApp — official Cloud API (optional).** Set `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_ACCESS_TOKEN`, and `WHATSAPP_TEMPLATE_ORDER` (an approved utility
  template). Requires a verified WhatsApp Business Account. Left blank → disabled
  (email still sends). PK numbers are auto-normalised to E.164.

  > Note: WhatsApp's official Cloud API has a limited free allowance then charges
  > per conversation. Unofficial libraries (whatsapp-web.js/Baileys) are free but
  > violate WhatsApp's ToS and risk bans — not used here.

Notifications never block or fail order placement (errors are logged only).

## Useful scripts

| Command | Description |
|---|---|
| `npm run db:up` / `db:down` | Start / stop MySQL + Redis |
| `npm run db:migrate` | Run Prisma migrations (auto-loads root `.env`) |
| `npm run db:seed` | Reseed demo data (idempotent — clears first) |
| `npm run db:reset` | Drop, re-migrate, reseed |
| `npm run db:studio` -w @store/database | Prisma Studio |
| `npm run build` | Build all packages + apps for production |

## Production / VPS deployment

Designed to run on a Hostinger/GoDaddy **VPS** (not shared hosting). See `deploy/` for a PM2 ecosystem file and an Nginx reverse-proxy sample. Outline:

1. Provision Ubuntu VPS (4 GB / 2 vCPU recommended), install Node 20, Nginx, PM2.
2. MySQL + Redis: self-host (Docker/apt) or use managed (PlanetScale/managed MySQL + Upstash).
3. `npm ci && npm run build && npm run db:migrate:deploy -w @store/database`
4. `pm2 start deploy/ecosystem.config.cjs` (API + storefront under PM2).
5. Nginx reverse-proxies 80/443 → apps; Cloudflare or Certbot for SSL.
6. Cron: nightly `pg_dump` to S3/Backblaze.

See `deploy/README.md` for details.
