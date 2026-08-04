# Deploying to Vercel

How to get the storefront, admin panel and API live using Vercel.

**Read [§1](#1-what-vercel-can-and-cant-host) first.** Vercel is excellent for two
of the three parts and a poor fit for the third — knowing that up front saves you
a wasted afternoon.

---

## Contents

- [1. What Vercel can and can't host](#1-what-vercel-cant-host)
- [2. The order matters](#2-the-order-matters)
- [3. Create the database](#3-create-the-database)
- [4. Deploy the API](#4-deploy-the-api)
- [5. Deploy the admin panel](#5-deploy-the-admin-panel)
- [6. Deploy the storefront](#6-deploy-the-storefront)
- [7. Connect them (CORS)](#7-connect-them-cors)
- [8. Load the demo data](#8-load-the-demo-data)
- [9. Test it](#9-test-it)
- [10. Settings reference](#10-settings-reference)
- [11. Troubleshooting](#11-troubleshooting)
- [Appendix: putting the API on Vercel anyway](#appendix-putting-the-api-on-vercel-anyway)

---

## 1. What Vercel can't host

| Part | Vercel? | Notes |
|---|---|---|
| **Storefront** (Next.js) | ✅ Perfect | Vercel builds Next.js — this is its home turf |
| **Admin panel** (Vite SPA) | ✅ Perfect | Just static files |
| **API** (Express + Prisma) | ⚠️ Possible, painful | See below |
| **MySQL database** | ❌ Not offered | Vercel hosts no MySQL. You need one elsewhere regardless. |

### Why the API is a poor fit

Vercel runs **serverless functions** — short-lived programs that start on each
request and then vanish. This API assumes a normal, always-running server, and
three things break:

1. **Database connections.** Every cold start opens a new pool. MySQL allows ~150
   connections total; a traffic spike exhausts them and the site goes down. Fixing
   this properly needs a connection pooler.
2. **Rate limiting stops working.** Login and checkout limits are counted in
   memory (`express-rate-limit` with its default store). Each serverless instance
   has its own memory, so an attacker gets the limit multiplied by however many
   instances are running. Your brute-force protection quietly weakens.
3. **Image uploads break.** Uploads fall back to writing to local disk when
   Cloudinary isn't configured. Vercel's filesystem is read-only and wiped
   between requests, so **Cloudinary becomes mandatory**, not optional.

### The recommendation

> **Storefront + admin on Vercel. API and MySQL on [Railway](https://railway.app)**
> (or [Render](https://render.com)).
>
> Railway runs a normal always-on Node process, gives you a MySQL database in the
> same project, and none of the three problems above exist. Free/cheap tier is
> plenty for testing.

If you must put everything on Vercel, see the [appendix](#appendix-putting-the-api-on-vercel-anyway).

---

## 2. The order matters

**⚠️ The API's address is compiled into the storefront and admin at build time.**
It is not read at runtime. Deploy in this order or you'll build them pointing at
nothing and have to rebuild:

```
1. Database        →  get connection string
2. API             →  get its URL     ← everything else needs this
3. Admin panel     →  build with the API URL
4. Storefront      →  build with the API URL
5. Update the API's CORS with the two new URLs
```

If you've already created a Vercel project for the admin and don't have the API
URL yet, that's fine — just don't deploy it successfully yet. Add the variable
first ([§5](#5-deploy-the-admin-panel)), then redeploy.

---

## 3. Create the database

Railway gives you MySQL and the API host in one place.

1. Go to [railway.app](https://railway.app) → sign in with GitHub
2. **New Project** → **Provision MySQL**
3. Click the MySQL service → **Variables** tab → copy **`MYSQL_URL`**

It looks like:

```
mysql://root:PASSWORD@monorail.proxy.rlwy.net:12345/railway
```

📝 Save it — this is your `DATABASE_URL`.

> **Other options:** [Aiven](https://aiven.io) (free MySQL), [TiDB Cloud](https://tidbcloud.com)
> (free, MySQL-compatible), or [PlanetScale](https://planetscale.com) (paid).
> Any MySQL 8 works.

---

## 4. Deploy the API

Still in the same Railway project:

1. **New** → **GitHub Repo** → select `OnlineStore`
2. Open the new service → **Settings**:

   | Setting | Value |
   |---|---|
   | **Root Directory** | *(leave blank — the repo root)* |
   | **Build Command** | `npm ci && npm run build:api` |
   | **Start Command** | `node apps/api/dist/index.js` |

3. **Variables** tab → add:

   ```
   NODE_ENV=production
   DATABASE_URL=<the MySQL URL from §3>
   DIRECT_DATABASE_URL=<the same URL>
   JWT_ACCESS_SECRET=<long random string>
   JWT_REFRESH_SECRET=<a different long random string>
   REVALIDATE_SECRET=<another random string>
   CORS_ORIGINS=http://localhost:3000
   REDIS_URL=
   SMTP_HOST=
   ```

   Generate the random strings with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

4. **Settings → Networking → Generate Domain**

You'll get something like `online-store-api.up.railway.app`.

**Check it:** open `https://YOUR-API.up.railway.app/api/health` — you should see
`{"status":"ok",...}`.

📝 **Save this URL.** Your API base is that URL **plus `/api`**:

```
https://online-store-api.up.railway.app/api
```

---

## 5. Deploy the admin panel

On Vercel → **Add New → Project** → import `OnlineStore`.

| Setting | Value |
|---|---|
| **Project Name** | `online-store-admin` |
| **Framework Preset** | **Vite** |
| **Root Directory** | `apps/admin` |
| **Build Command** | *leave default* |
| **Output Directory** | *leave default* (`dist`) |
| **Install Command** | *leave default* (`npm install --prefix=../..`) |

**The defaults are correct here.** The admin's `vite.config.ts` points
`@store/shared-types` straight at the source files, so nothing needs pre-building.

### ⚠️ The one thing you must add

Open **Environment Variables** and add:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://YOUR-API.up.railway.app/api` |

**Without this the admin cannot talk to the API.** It's compiled into the
JavaScript at build time — adding it later means clicking **Redeploy**, not just
saving.

Click **Deploy**. You'll get `online-store-admin.vercel.app`.

---

## 6. Deploy the storefront

Vercel → **Add New → Project** → import the same repo again.

| Setting | Value |
|---|---|
| **Project Name** | `online-store` |
| **Framework Preset** | **Next.js** |
| **Root Directory** | `apps/storefront` |
| **Build Command** | **`cd ../.. && npm run build:storefront`** ← override this |
| **Output Directory** | *leave default* |
| **Install Command** | *leave default* |

### ⚠️ Why the build command must be overridden

Unlike the admin, the storefront imports `@store/shared-types` as a real package,
so that package must be **compiled first**. The default build command doesn't do
that and the deploy fails with:

```
Module not found: Can't resolve '@store/shared-types'
```

`npm run build:storefront` compiles the shared package and then builds Next.js.

### Environment variables

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-API.up.railway.app/api` |
| `NEXT_PUBLIC_SITE_URL` | *leave empty while testing* — see below |
| `STOREFRONT_URL` | `https://online-store.vercel.app` |
| `REVALIDATE_SECRET` | *(the same value you set on the API)* |

> **Leave `NEXT_PUBLIC_SITE_URL` empty until you're live.** While it's empty,
> `robots.txt` returns `Disallow: /` and search engines skip the site. Set it and
> Google will index your test deployment. Fill it in with the real domain when you
> launch — and **redeploy**, since it's baked in at build time.

Click **Deploy**.

---

## 7. Connect them (CORS)

The API refuses browser requests from addresses it doesn't recognise. Go back to
**Railway → API service → Variables** and set:

```
CORS_ORIGINS=https://online-store.vercel.app,https://online-store-admin.vercel.app
```

Use your real Vercel URLs, `https://`, no trailing slash, comma-separated, no
spaces. Also set:

```
STOREFRONT_URL=https://online-store.vercel.app
```

Railway redeploys automatically.

> **This is the #1 cause of "it works in curl but not the browser".** If products
> load with `curl` but the site shows nothing, this variable is wrong.

---

## 8. Load the demo data

The database is empty. From your own computer:

```bash
cd OnlineStore

# point at the Railway database
export DATABASE_URL="mysql://root:PASSWORD@monorail.proxy.rlwy.net:12345/railway"
export DIRECT_DATABASE_URL="$DATABASE_URL"
export SEED_ADMIN_EMAIL="admin@yourdomain.com"
export SEED_ADMIN_PASSWORD="PickAStrongPassword123"

npm run migrate:deploy -w @store/database   # create the tables
npm run db:seed                             # demo products + your admin login
```

The seed prints the admin login it created — that's what you use on the admin
panel.

> ⚠️ `db:seed` **wipes and reloads** catalogue data. Fine now; never run it once
> you have real orders.

---

## 9. Test it

```bash
curl https://YOUR-API.up.railway.app/api/health
curl "https://YOUR-API.up.railway.app/api/products?pageSize=2"
curl https://online-store.vercel.app/robots.txt     # must say "Disallow: /"
```

In a browser:

- [ ] Storefront shows products
- [ ] Product → add to cart → correct total
- [ ] Checkout without logging in (guest checkout — email only)
- [ ] Order confirmation appears
- [ ] Admin logs in with the seeded account
- [ ] Admin → Orders shows the order with a **GUEST** badge

---

## 10. Settings reference

**Admin** (Vercel)

```
Framework:       Vite
Root Directory:  apps/admin
Build Command:   (default)
Output:          (default — dist)
Install:         (default — npm install --prefix=../..)
Env:             VITE_API_URL = https://YOUR-API.up.railway.app/api
```

**Storefront** (Vercel)

```
Framework:       Next.js
Root Directory:  apps/storefront
Build Command:   cd ../.. && npm run build:storefront     ← override
Output:          (default)
Install:         (default)
Env:             NEXT_PUBLIC_API_URL = https://YOUR-API.up.railway.app/api
                 NEXT_PUBLIC_SITE_URL = (empty while testing)
                 STOREFRONT_URL = https://online-store.vercel.app
                 REVALIDATE_SECRET = (same as the API)
```

**API** (Railway)

```
Build:           npm ci && npm run build:api
Start:           node apps/api/dist/index.js
Env:             NODE_ENV, DATABASE_URL, DIRECT_DATABASE_URL,
                 JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, REVALIDATE_SECRET,
                 CORS_ORIGINS, STOREFRONT_URL
```

### What needs a redeploy vs a restart

Anything starting with `NEXT_PUBLIC_` or `VITE_` is **compiled into the files**.
Changing it in the dashboard does nothing until you **Redeploy**. API variables
take effect on restart, which Railway does automatically.

---

## 11. Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| `Module not found: Can't resolve '@store/shared-types'` | Storefront build command not overridden | Set it to `cd ../.. && npm run build:storefront` ([§6](#6-deploy-the-storefront)) |
| Admin loads but nothing works; console shows CORS errors | `CORS_ORIGINS` missing the admin URL | [§7](#7-connect-them-cors) |
| Storefront shows no products, `curl` on the API works | `NEXT_PUBLIC_API_URL` wrong or set after building | Fix it, then **Redeploy** |
| Admin shows a blank page | `VITE_API_URL` never set | Add it, then **Redeploy** |
| `Can't reach database server` | Wrong `DATABASE_URL`, or DB asleep on a free tier | Re-copy from Railway; check the DB service is running |
| `Table 'Product' doesn't exist` | Migrations not run | `npm run migrate:deploy -w @store/database` ([§8](#8-load-the-demo-data)) |
| `PrismaClientInitializationError` on Vercel | Prisma client not generated for the build platform | Already handled — `schema.prisma` includes the right engine targets |
| Test site showing up in Google | `NEXT_PUBLIC_SITE_URL` was filled in | Empty it and redeploy |
| Vercel build fails on install | Workspace not installed from the root | Install Command should be `npm install --prefix=../..` |

---

## Appendix: putting the API on Vercel anyway

If you really want everything on Vercel, understand what you're taking on
([§1](#1-what-vercel-cant-host)): weakened rate limiting, mandatory Cloudinary, and
database connections that need a pooler.

**1. Add a serverless entry point** — `apps/api/api/index.ts`:

```ts
// Vercel serverless entry. The VPS/Railway build uses src/index.ts, which calls
// listen(); serverless instead exports the app and lets the platform invoke it.
import { createApp } from '../src/app';

export default createApp();
```

**2. Add `apps/api/vercel.json`:**

```json
{
  "version": 2,
  "builds": [{ "src": "api/index.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "api/index.ts" }]
}
```

**3. Solve connection pooling** — otherwise you will hit
`Too many connections` under load. Either:

- **[Prisma Accelerate](https://www.prisma.io/accelerate)** — set `DATABASE_URL`
  to the Accelerate URL, keep `DIRECT_DATABASE_URL` pointing at the real database
  for migrations; or
- a MySQL host with a built-in pooler.

Also add `?connection_limit=1` to the runtime URL so each instance opens only one
connection.

**4. Configure Cloudinary** — set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`
and `CLOUDINARY_API_SECRET`. Without them, admin image uploads try to write to a
read-only filesystem and fail.

**5. Accept the rate-limit weakness**, or move the limiter to a Redis-backed store
([Upstash](https://upstash.com) has a free tier) so counts are shared across
instances.

> I have not verified this path end to end — unlike the Railway route above, which
> follows the app's existing production setup. If you go this way, test login
> rate limiting and image upload specifically.
