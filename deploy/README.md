# Deployment (VPS — Hostinger / GoDaddy)

This app targets a **VPS or Cloud Hosting** tier with root/SSH access (recommended).
It can **also** run on **cPanel** — but only on plans with Node.js app support, and
with external database/Redis. See [Alternative: cPanel hosting](#alternative-cpanel-hosting) below.

## Recommended spec
4 GB RAM / 2 vCPU minimum (Node API + Next.js SSR + MySQL + Redis on one box). Offload MySQL/Redis to managed tiers (PlanetScale / managed MySQL, Upstash) if RAM is tight.

## One-time server setup
```bash
sudo apt update && sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install -y nodejs
sudo npm i -g pm2
# MySQL + Redis: apt/docker locally, or use managed URLs in .env
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

MySQL caps total connections (`max_connections`, default ~151) and each idle
connection costs RAM — critical on a small VPS. The app reuses a bounded pool of
connections instead of opening one per request.

**Two URLs (see `.env.example`):**
- `DATABASE_URL` — runtime queries. Carries `connection_limit` + `pool_timeout`.
  Point it at a **pooler** (ProxySQL, or a managed MySQL's pooled endpoint) in production.
- `DIRECT_DATABASE_URL` — a **direct** (non-pooled) connection used only for
  migrations/introspection.

**Sizing rule — never exceed MySQL's limit:**
```
connection_limit × (PM2 instances) ≤ max_connections − headroom(~20)
```
Examples on a 2-vCPU box with `max_connections=151`:
- 1 API process → `connection_limit=10` (default here)
- 2 API processes (both cores) → `connection_limit=10` each = 20 total ✓

**Managed MySQL (PlanetScale / RDS / cloud):** use the provider's connection
string for both URLs (pooled endpoint for `DATABASE_URL` if offered). Note:
`prisma migrate dev` needs privileges to create a temporary shadow database — in
production use `migrate deploy` (no shadow DB), so a limited DB user is fine.

## SSL
Use Cloudflare (proxy DNS, free SSL) **or** Certbot: `sudo certbot --nginx`.

## Backups (cron)
```bash
# nightly mysqldump to Backblaze/S3
0 2 * * * mysqldump -h HOST -uUSER -pPASS clothing_store | gzip > /backups/store-$(date +\%F).sql.gz
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
- cPanel gives you **MySQL/MariaDB** (which this app now uses ✓) and **no Redis**, usually no root.

### What changes vs the VPS setup
| Concern | On cPanel |
|---|---|
| **Database** | ✅ The app runs on **MySQL** — use cPanel's **native MySQL** directly. Create a database + user in *MySQL® Databases*, then set `DATABASE_URL`/`DIRECT_DATABASE_URL` to `mysql://user:pass@localhost:3306/dbname`. Run `migrate deploy` (not `migrate dev`, which needs shadow-DB privileges the cPanel user lacks). |
| **Redis** | No Redis on shared cPanel. Use **Upstash** (external) or leave it unset — the cache is fail-open and rate-limiting falls back to in-memory, so the app still runs. |
| **Images** | Keep **Cloudinary** (already wired) — cPanel disk isn't a good media store. |
| **Process mgr** | **Passenger** manages the Node process (no PM2). It sets `PORT` (the API already honours it). |
| **Email** | Use your **cPanel mailbox SMTP** — set `SMTP_HOST`/`SMTP_USER`/… in the app's env vars. |

### Prisma engine target (already configured ✓)
`schema.prisma` already includes CloudLinux engines
(`binaryTargets = ["native", "rhel-openssl-3.0.x", "rhel-openssl-1.1.x"]`), so the
Prisma client runs on cPanel out of the box. Just run `npm run build:packages`
(or `npm run db:generate`) on the server so the right engine is present.

### Environment variables
Copy **`deploy/cpanel.env.example`** — it lists every var to set under each Node
app's *Environment variables* (DB, JWT, CORS, Cloudinary, SMTP, revalidation,
`NEXT_PUBLIC_API_URL`/`VITE_API_URL`). Redis is optional — leave `REDIS_URL`
blank on shared cPanel and caching is skipped cleanly.

### Steps

1. **Build locally** (or on the server after upload):
   ```bash
   npm run build          # api → dist, storefront → .next, admin → dist
   ```
2. **Create the MySQL database** in cPanel → *MySQL® Databases* (a DB + a user, granted all privileges), then run migrations against it:
   ```bash
   DIRECT_DATABASE_URL="mysql://user:pass@localhost:3306/dbname" npm run migrate:deploy -w @store/database
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
- Backups: use cPanel's built-in backup, or a nightly `mysqldump` (cPanel → Cron Jobs). Managed MySQL providers handle backups for you.
- If you outgrow cPanel limits, the same code moves to the VPS flow above unchanged.
