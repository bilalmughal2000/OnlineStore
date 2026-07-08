# Deployment (VPS — Hostinger / GoDaddy)

This app targets a **VPS or Cloud Hosting** tier with root/SSH access. Basic shared/cPanel hosting cannot run Node/Postgres/Redis and will not work.

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
