# Deployment (VPS — Hostinger / GoDaddy)

This app targets a **VPS or Cloud Hosting** tier with root/SSH access (recommended).
It can **also** run on **cPanel** — but only on plans with Node.js app support, and
with external database/Redis. See [Alternative: cPanel hosting](#alternative-cpanel-hosting) below.

## Recommended spec
4 GB RAM / 2 vCPU minimum (Node API + Next.js SSR + Postgres + Redis on one box). Offload Postgres/Redis to managed tiers (Supabase/Neon, Upstash) if RAM is tight.

## One-time server setup
```bash
sudo apt update && sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install -y nodejs
sudo npm i -g pm2
# Postgres + Redis: apt/docker locally, or use managed URLs in .env
```

## Deploy
```bash
git clone <repo> /var/www/store && cd /var/www/store
cp .env.example .env      # fill in production secrets, DB/Redis URLs, gateway keys
npm ci
npm run build             # builds packages + api + storefront + admin
npm run db:migrate:deploy -w @store/database

pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup

sudo cp deploy/nginx.conf /etc/nginx/sites-available/store
sudo ln -s /etc/nginx/sites-available/store /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Database connection pooling

Postgres caps total connections (`max_connections`, default ~100) and each idle
connection costs RAM — critical on a small VPS. The app reuses a bounded pool of
connections instead of opening one per request.

**Two URLs (see `.env.example`):**
- `DATABASE_URL` — runtime queries. Carries `connection_limit` + `pool_timeout`.
  Point it at a **pooler** (PgBouncer / Supabase / Neon pooler) in production.
- `DIRECT_DATABASE_URL` — a **direct** (non-pooled) connection used only for
  migrations/introspection (PgBouncer transaction mode can't run them).

**Sizing rule — never exceed Postgres's limit:**
```
connection_limit × (PM2 instances) ≤ max_connections − headroom(~20)
```
Examples on a 2-vCPU box with `max_connections=100`:
- 1 API process → `connection_limit=10` (default here)
- 2 API processes (both cores) → `connection_limit=10` each = 20 total ✓

**PgBouncer (transaction mode):** add `pgbouncer=true` to `DATABASE_URL` (Prisma
then disables prepared statements, which that mode doesn't support), and keep
`DIRECT_DATABASE_URL` pointing at the real Postgres port (5432), not PgBouncer (6432).

**Managed DB (Supabase/Neon):** use their **pooler** connection string for
`DATABASE_URL` and their **direct** string for `DIRECT_DATABASE_URL` — their free
tiers enforce low connection limits, so the pooler is mandatory at any real traffic.

## SSL
Use Cloudflare (proxy DNS, free SSL) **or** Certbot: `sudo certbot --nginx`.

## Backups (cron)
```bash
# nightly pg_dump to Backblaze/S3
0 2 * * * pg_dump "$DATABASE_URL" | gzip > /backups/store-$(date +\%F).sql.gz
```

## CI/CD
`.github/workflows/deploy.yml` builds + typechecks on push, then (with SSH secrets configured) can `git pull && npm ci && npm run build && pm2 reload all` on the VPS.

---

## Alternative: cPanel hosting

cPanel can host this app, **but with hard constraints**. Read this first.

### ⚠️ Will your cPanel plan work?
- **Required:** the plan must have **"Setup Node.js App"** (a.k.a. Node.js Selector,
  powered by Phusion Passenger — common on **CloudLinux** hosts like Hostinger,
  Namecheap, A2, HostGator business tiers). Check cPanel home → *Software* section.
- **Won't work:** legacy PHP-only shared hosting with no Node.js app feature. There's
  no way to run a persistent Node/Next process there.
- cPanel gives you **MySQL/MariaDB (not PostgreSQL)** and **no Redis**, usually no root.

### What changes vs the VPS setup
| Concern | On cPanel |
|---|---|
| **Database** | cPanel has no PostgreSQL. **Recommended:** use external managed Postgres (**Supabase/Neon**) — set `DATABASE_URL`/`DIRECT_DATABASE_URL` to it, **no code change**. *(Alternative: switch Prisma to MySQL — `provider = "mysql"` in `schema.prisma` + re-migrate. More work; avoid unless required.)* |
| **Redis** | No Redis on shared cPanel. Use **Upstash** (external) or leave it unset — the cache is fail-open and rate-limiting falls back to in-memory, so the app still runs. |
| **Images** | Keep **Cloudinary** (already wired) — cPanel disk isn't a good media store. |
| **Process mgr** | **Passenger** manages the Node process (no PM2). It sets `PORT` (the API already honours it). |
| **Email** | Use your **cPanel mailbox SMTP** — set `SMTP_HOST`/`SMTP_USER`/… in the app's env vars. |

### Prisma engine target (important)
Passenger hosts are usually CloudLinux (RHEL-based). Add the matching engine to
`packages/database/prisma/schema.prisma` so the client runs there, then regenerate:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]   // use rhel-openssl-1.1.x on older hosts
}
```
`npm run db:generate` again after changing this.

### Steps

1. **Build locally** (or on the server after upload):
   ```bash
   npm run build          # api → dist, storefront → .next, admin → dist
   ```
2. **Provision an external database** (Supabase/Neon) and run migrations against it:
   ```bash
   DIRECT_DATABASE_URL="<neon direct url>" npm run migrate:deploy -w @store/database
   npm run db:seed        # optional first-time demo data
   ```
3. **Upload the code** — cPanel **Git Version Control** (clone your repo) or File Manager (zip upload). Exclude `node_modules` (install it on the server in step 4).
4. **Create the API Node app** — cPanel → *Setup Node.js App* → *Create Application*:
   - Node.js version: **20+**
   - Application root: `apps/api`
   - Application startup file: `dist/index.js`
   - Add **Environment variables**: `DATABASE_URL`, `DIRECT_DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `CLOUDINARY_*`, `SMTP_*`, `NODE_ENV=production`, (optional `REDIS_URL`).
   - Click **Run NPM Install**, then **Start**. Passenger serves it on the app's URL/subdomain (e.g. `api.yourdomain.com`).
5. **Create the storefront Node app** — same tool:
   - Application root: `apps/storefront`
   - Application startup file: **`server.js`** (a Passenger entry is included in the repo)
   - Env var: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api`
   - Run NPM Install, then Start → maps to `yourdomain.com`.
6. **Host the admin (static)** — the admin is a static SPA build:
   - Create a subdomain `admin.yourdomain.com` and point its document root at `apps/admin/dist`.
   - Set `VITE_API_URL=https://api.yourdomain.com/api` **before** building the admin.
   - The included `public/.htaccess` (shipped into `dist/`) handles SPA routing.
7. **CORS** — set the API's `CORS_ORIGINS` to `https://yourdomain.com,https://admin.yourdomain.com`.
8. **SSL** — use cPanel's **AutoSSL** (Let's Encrypt) for all three domains.

### Notes / gotchas
- Each Node app on cPanel gets its **own subdomain**; there's no root Nginx to reverse-proxy `/api` under one domain — hence the `api.` subdomain + absolute `NEXT_PUBLIC_API_URL`.
- Passenger **restarts** the app when you touch `tmp/restart.txt` in the app root (cPanel's "Restart" button does this).
- Backups: if the DB is external (Supabase/Neon), backups are handled by that provider — no cron needed.
- If you outgrow cPanel limits, the same code moves to the VPS flow above unchanged.
