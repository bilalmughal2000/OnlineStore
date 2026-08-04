# Deploying to cPanel Subdomains (Test Environment)

How to put the **storefront, admin panel and API** on three test subdomains of a
cPanel account **without touching the WordPress site already running on the main
domain**.

This is a *staging* deployment. Section [§9](#9-keep-the-test-site-out-of-public-view)
covers keeping it out of Google and out of your real customer data — please don't
skip it.

> For production on a VPS, see [`deploy/README.md`](../deploy/README.md).

---

## Table of contents

1. [What you'll end up with](#1-what-youll-end-up-with)
2. [Why this won't break WordPress](#2-why-this-wont-break-wordpress)
3. [Before you start](#3-before-you-start)
4. [Create the subdomains](#4-create-the-subdomains)
5. [Create the database](#5-create-the-database)
6. [Get the code onto the server](#6-get-the-code-onto-the-server)
7. [Environment variables](#7-environment-variables)
8. [Build, migrate, seed](#8-build-migrate-seed)
9. [Keep the test site out of public view](#9-keep-the-test-site-out-of-public-view)
10. [Create the API Node app](#10-create-the-api-node-app)
11. [Create the storefront Node app](#11-create-the-storefront-node-app)
12. [Publish the admin panel](#12-publish-the-admin-panel)
13. [SSL](#13-ssl)
14. [Verification checklist](#14-verification-checklist)
15. [Redeploying after a change](#15-redeploying-after-a-change)
16. [Troubleshooting](#16-troubleshooting)
17. [Removing the test environment](#17-removing-the-test-environment)

---

## 1. What you'll end up with

Replace `yourdomain.com` with your real domain throughout.

| Subdomain | What runs there | How it's served |
|---|---|---|
| `shop-test.yourdomain.com` | Storefront (Next.js) | Node.js app (Passenger) |
| `admin-test.yourdomain.com` | Admin panel (React SPA) | **Static files** — no Node process |
| `api-test.yourdomain.com` | API (Express + Prisma) | Node.js app (Passenger) |

`yourdomain.com` — your WordPress site — is **not touched**.

```
yourdomain.com                    → public_html/            (WordPress, untouched)
shop-test.yourdomain.com          → shoptest/               (Passenger → Next.js)
admin-test.yourdomain.com         → admintest/              (static admin build)
api-test.yourdomain.com           → apitest/                (Passenger → Express)
                                     ~/onlinestore/         (the repo — outside every docroot)
```

**Why three subdomains and not one?** On cPanel each Node.js app gets its own
domain — there's no root Nginx you can use to reverse-proxy `/api` under a single
hostname. So the API lives on its own subdomain and the storefront/admin call it
by absolute URL.

---

## 2. Why this won't break WordPress

Worth understanding before you click anything, because the two ways this *could*
go wrong are both avoidable:

1. **Each subdomain gets its own document root.** Creating a subdomain does not
   modify `public_html`. WordPress keeps serving from where it always did.
2. **cPanel's "Setup Node.js App" writes an `.htaccess`** into the application's
   document root to hand requests to Passenger. If you ever pointed a Node app at
   `public_html`, that `.htaccess` would hijack your WordPress site.

> ⚠️ **The one rule: never set a Node app's Application Root or a subdomain's
> Document Root to `public_html` or anything inside it.** Everything below keeps
> them in separate directories.

The database is separate too — a new database, not the WordPress one.

---

## 3. Before you start

**Confirm your plan supports Node.js.** cPanel home → *Software* → you need
**Setup Node.js App**. Without it (plain PHP shared hosting) there is no way to
run a persistent Node process, and this deployment isn't possible.

**Check the Node version offered** — you need **20 or newer**.

**You'll also want:** Terminal access (cPanel → *Terminal*) or SSH. It's possible
via File Manager alone, but `npm install` and Prisma migrations are far easier in
a shell.

**Resource note.** Two Node processes plus MySQL on shared hosting is tight. The
storefront needs ~300–500 MB during build. If your plan caps memory
(`LVE` limits on CloudLinux), build locally and upload instead — see
[§8](#8-build-migrate-seed).

---

## 4. Create the subdomains

cPanel → **Domains** → *Create A Domain* (older cPanel: *Subdomains*). Create all
three, giving each its own document root:

| Domain | Document Root |
|---|---|
| `shop-test.yourdomain.com` | `/home/USER/shoptest` |
| `admin-test.yourdomain.com` | `/home/USER/admintest` |
| `api-test.yourdomain.com` | `/home/USER/apitest` |

Untick *"Share document root with…"* if offered — each needs its own.

> Replace `USER` with your cPanel username everywhere in this guide.

If your DNS is at Cloudflare or another external provider rather than cPanel, add
an **A record** for each subdomain pointing at your server's IP. (If you use
Cloudflare's proxy, set these three to **DNS only / grey cloud** while testing —
it makes SSL and debugging much simpler.)

---

## 5. Create the database

cPanel → **MySQL® Databases**:

1. **Create a new database** — e.g. `USER_storetest`
   *(Do not reuse the WordPress database.)*
2. **Create a new user** — e.g. `USER_storetest` with a strong password.
3. **Add the user to the database** with **ALL PRIVILEGES**.

Note the final names — cPanel prefixes both with your username, so you'll end up
with something like `bilal_storetest`.

Your connection string will be:

```
mysql://USER_storetest:PASSWORD@localhost:3306/USER_storetest
```

> **Use `migrate deploy`, never `migrate dev`.** `migrate dev` needs privileges to
> create a temporary shadow database, which a cPanel user doesn't have. The deploy
> command needs no shadow DB.

---

## 6. Get the code onto the server

Put the repo **outside every document root** — at `/home/USER/onlinestore`. Source
code should never sit where a web server can serve it.

### Option A — cPanel Git Version Control (recommended)

cPanel → **Git™ Version Control** → *Create*:

- **Clone URL**: your repo (HTTPS with a token, or add cPanel's SSH key to GitHub)
- **Repository Path**: `/home/USER/onlinestore`
- **Branch**: `feat/marketing-and-guest-checkout` (or `master` once merged)

Pulling later is then one click.

### Option B — upload a zip

Build locally, zip **without `node_modules`**, upload via File Manager to
`/home/USER/`, and extract to `onlinestore`.

```bash
# on your machine
git archive --format=zip -o onlinestore.zip HEAD
```

---

## 7. Environment variables

Create `/home/USER/onlinestore/.env`. Start from
[`deploy/cpanel.env.example`](../deploy/cpanel.env.example).

```bash
# ── Environment ─────────────────────────────────────────────
NODE_ENV=production

# ── Database (from §5) ──────────────────────────────────────
DATABASE_URL=mysql://USER_storetest:PASSWORD@localhost:3306/USER_storetest?connection_limit=5&pool_timeout=20
DIRECT_DATABASE_URL=mysql://USER_storetest:PASSWORD@localhost:3306/USER_storetest

# ── Auth — generate real random values, don't reuse these ───
JWT_ACCESS_SECRET=PASTE_A_LONG_RANDOM_STRING
JWT_REFRESH_SECRET=PASTE_A_DIFFERENT_LONG_RANDOM_STRING
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# ── Who may call the API ────────────────────────────────────
CORS_ORIGINS=https://shop-test.yourdomain.com,https://admin-test.yourdomain.com

# ── Where the apps live ─────────────────────────────────────
NEXT_PUBLIC_API_URL=https://api-test.yourdomain.com/api
VITE_API_URL=https://api-test.yourdomain.com/api
STOREFRONT_URL=https://shop-test.yourdomain.com
REVALIDATE_SECRET=ANOTHER_RANDOM_STRING

# ── Redis: leave blank. Shared cPanel has none; caching is skipped cleanly ──
REDIS_URL=

# ── Seed admin (used only by `npm run db:seed`) ─────────────
SEED_ADMIN_EMAIL=admin@yourdomain.com
SEED_ADMIN_PASSWORD=CHANGE_THIS

# ── TEST SETTINGS — see §9 before changing any of these ─────
NEXT_PUBLIC_SITE_URL=
SMTP_HOST=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_META_PIXEL_ID=
META_PIXEL_ID=
META_CAPI_ACCESS_TOKEN=
```

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then lock the file down so other accounts on the server can't read it:

```bash
chmod 600 /home/USER/onlinestore/.env
```

> **Two things people get wrong here:**
>
> 1. **`NEXT_PUBLIC_*` values are compiled into the JavaScript at build time.**
>    Changing them later means **rebuilding**, not just restarting.
> 2. **`CORS_ORIGINS` must list the exact `https://` origins** of the storefront
>    and admin. Get this wrong and every browser request fails with a CORS error
>    while `curl` still works — which is a confusing hour to lose.

---

## 8. Build, migrate, seed

In cPanel → **Terminal**:

```bash
cd ~/onlinestore
npm ci                      # or `npm install` if npm ci complains
npm run build               # packages → api → storefront → admin
```

The build takes several minutes. If it is **killed** partway, your plan's memory
limit is the cause — build on your own machine instead and upload the outputs:

```
apps/api/dist/            apps/storefront/.next/
apps/admin/dist/          node_modules/  (or run npm ci on the server)
packages/*/dist/
```

Then apply the schema and load demo data:

```bash
npm run migrate:deploy -w @store/database
npm run db:seed             # optional: demo products + admin/customer logins
```

`db:seed` **clears and reloads** catalogue data. Fine on a fresh test database —
never run it against anything real.

---

## 9. Keep the test site out of public view

Four things will otherwise leak your test environment into the real world. All are
just env values you leave blank.

### 9.1 Google must not index it

A test store competing with your real domain in search results is a genuine SEO
problem.

**Leave `NEXT_PUBLIC_SITE_URL` blank.** The storefront's `robots.txt` returns
`Disallow: /` unless that variable is set to a real non-localhost domain — a
deliberate safety net. Verify after deploying:

```bash
curl https://shop-test.yourdomain.com/robots.txt
# expected:
#   User-Agent: *
#   Disallow: /
```

For belt and braces, add HTTP auth: cPanel → **Directory Privacy** on
`/home/USER/shoptest`.

### 9.2 No real emails to real customers

**Leave `SMTP_HOST` blank.** Order confirmations are then written to the app log
instead of being sent. Any test order using a real address would otherwise email
that person.

### 9.3 No polluted ad data

**Leave `NEXT_PUBLIC_META_PIXEL_ID`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` and
`NEXT_PUBLIC_GA_MEASUREMENT_ID` blank.** With them set, every test order reports a
fake conversion to Meta and trains your ad optimisation on rubbish. Nothing loads
when they're blank.

To test the Pixel specifically, use a **separate test pixel**, or set
`META_CAPI_TEST_EVENT_CODE` so events land in *Test Events* and never count as
conversions.

### 9.4 Separate database

Already handled in [§5](#5-create-the-database) — a new database, not WordPress's.

---

## 10. Create the API Node app

cPanel → **Setup Node.js App** → *Create Application*:

| Field | Value |
|---|---|
| Node.js version | **20** or newer |
| Application mode | **Production** |
| Application root | `onlinestore/apps/api` |
| Application URL | `api-test.yourdomain.com` |
| Application startup file | `dist/index.js` |

Then:

1. Add **Environment variables** in the app's panel. Passenger does **not** read
   your `.env` automatically, so add at minimum:
   `NODE_ENV`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `STOREFRONT_URL`, `REVALIDATE_SECRET`
   (plus `CLOUDINARY_*` / `SMTP_*` if you're using them).
2. Click **Run NPM Install**.
3. Click **Start** (or **Restart**).

Check it:

```bash
curl https://api-test.yourdomain.com/api/health
# {"status":"ok","time":"..."}
```

> **Passenger provides the port** via `PORT`, which the API already honours — don't
> set `API_PORT` here.

---

## 11. Create the storefront Node app

Same tool, *Create Application*:

| Field | Value |
|---|---|
| Node.js version | **20** or newer |
| Application mode | **Production** |
| Application root | `onlinestore/apps/storefront` |
| Application URL | `shop-test.yourdomain.com` |
| Application startup file | **`server.js`** |

`server.js` is the Passenger entry point already in the repo — it boots Next.js in
production mode on the port Passenger supplies. It requires `.next/` to exist, so
**the build in [§8](#8-build-migrate-seed) must have succeeded first.**

Environment variables to add: `NODE_ENV=production`, `NEXT_PUBLIC_API_URL`.

Then **Run NPM Install** → **Start**.

> If you change `NEXT_PUBLIC_API_URL` later you must **rebuild** the storefront —
> restarting is not enough, because the value is baked into the compiled JS.

---

## 12. Publish the admin panel

The admin is a **static build** — no Node process, no Passenger app.

**The API URL is compiled in at build time**, so `VITE_API_URL` must be correct
*before* you build:

```bash
cd ~/onlinestore
VITE_API_URL=https://api-test.yourdomain.com/api npm run build:admin
cp -r apps/admin/dist/. ~/admintest/
```

`apps/admin/dist/` includes an `.htaccess` that routes all paths back to
`index.html`, which is what a single-page app needs — without it, refreshing on
`/orders` returns a 404.

Confirm it copied:

```bash
ls -a ~/admintest | head    # expect index.html, assets/, .htaccess
```

---

## 13. SSL

cPanel → **SSL/TLS Status** → tick all three subdomains → **Run AutoSSL**.

Wait until all three show a valid certificate before testing. Mixed content
(an `https://` page calling an `http://` API) is blocked by browsers, and the
symptom — requests that silently fail — looks like a broken app.

If DNS is behind Cloudflare's proxy, either set the three subdomains to **DNS
only** during AutoSSL, or use Cloudflare's own certificate with SSL mode **Full
(strict)**.

---

## 14. Verification checklist

```bash
# API up
curl https://api-test.yourdomain.com/api/health

# Catalogue returns products
curl "https://api-test.yourdomain.com/api/products?pageSize=2"

# Storefront renders
curl -I https://shop-test.yourdomain.com

# Test site is NOT indexable  → must say "Disallow: /"
curl https://shop-test.yourdomain.com/robots.txt

# Admin loads
curl -I https://admin-test.yourdomain.com
```

Then in a browser:

- [ ] Storefront home shows products
- [ ] Product page → add to cart → cart shows correct total
- [ ] **Guest checkout**: order without logging in, email required
- [ ] Confirmation page appears (order email is in the log, not sent — expected)
- [ ] Admin login works, order appears with a **GUEST** badge
- [ ] Admin → Customers & Users → **Guest customers only** lists the buyer
- [ ] Admin → Products → edit and save a product
- [ ] **WordPress on `yourdomain.com` still works** ← check this explicitly

---

## 15. Redeploying after a change

```bash
cd ~/onlinestore
git pull                                    # or cPanel → Git → Update from Remote
npm ci                                      # only if dependencies changed
npm run build
npm run migrate:deploy -w @store/database   # only if the schema changed

# admin (static) — rebuild only if admin code or VITE_API_URL changed
VITE_API_URL=https://api-test.yourdomain.com/api npm run build:admin
cp -r apps/admin/dist/. ~/admintest/
```

Then **Restart** both Node apps in *Setup Node.js App* (or `touch tmp/restart.txt`
in each application root — that's what the button does).

**Restart is enough for:** API code, storefront server-side code.
**A rebuild is required for:** any `NEXT_PUBLIC_*` or `VITE_API_URL` change, and
any storefront/admin code change.

---

## 16. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| WordPress site breaks after setup | A Node app or subdomain was pointed at `public_html` | Delete that app/subdomain, remove the Passenger `.htaccess` from `public_html`, recreate with the correct root ([§2](#2-why-this-wont-break-wordpress)) |
| 503 from a Node app | App not started, or startup file wrong | *Setup Node.js App* → Restart; check the log; confirm `dist/index.js` / `server.js` |
| Storefront 503, API fine | `.next/` missing — build didn't run or was killed | Re-run `npm run build`; if killed, build locally and upload |
| Storefront loads, no products | `NEXT_PUBLIC_API_URL` wrong, or baked in before you set it | Fix the value and **rebuild** |
| Browser CORS errors, `curl` fine | `CORS_ORIGINS` missing the exact origin | Set both `https://` origins on the API app, restart |
| Admin is blank / 404 on refresh | `.htaccess` missing from the docroot | `cp -r apps/admin/dist/. ~/admintest/` (note the `/.`, which copies dotfiles) |
| `PrismaClientInitializationError` | Client generated for the wrong platform | `npm run db:generate` **on the server**; CloudLinux targets are already in `schema.prisma` |
| `Can't reach database server` | Wrong credentials, or user not added to the DB | Recheck the cPanel-prefixed names and that the user has ALL PRIVILEGES |
| `migrate dev` fails on shadow DB | Wrong command | Use `npm run migrate:deploy -w @store/database` |
| Build killed | Plan memory limit | Build locally, upload `.next/` and `dist/` |
| Test site appearing in Google | `NEXT_PUBLIC_SITE_URL` was set | Blank it, rebuild, and add Directory Privacy ([§9.1](#91-google-must-not-index-it)) |

**Where the logs are:** *Setup Node.js App* shows a log path per application
(usually `~/logs/`). Tail it while reproducing:

```bash
tail -f ~/logs/api-test.yourdomain.com.log
```

---

## 17. Removing the test environment

1. *Setup Node.js App* → **Destroy** both applications.
2. *Domains* → remove the three subdomains.
3. *MySQL® Databases* → delete `USER_storetest` and its user.
4. Delete `~/onlinestore`, `~/shoptest`, `~/admintest`, `~/apitest`.

WordPress and `public_html` are untouched by all of the above.

---

## Going to production later

When you move from testing to a real store, the changes are:

- Point real domains at the apps (or move to a VPS — see [`deploy/README.md`](../deploy/README.md))
- Set `NEXT_PUBLIC_SITE_URL` to the real domain **and rebuild**, so `robots.txt`
  allows crawling and canonical URLs are correct
- Fill in SMTP so customers actually receive order emails
- Fill in the Meta/GA values — see [`docs/META_ADS.md`](META_ADS.md)
- Set `CLOUDINARY_*` so product images aren't stored on the cPanel disk
- Do **not** run `db:seed` — it wipes catalogue data
- Set up backups (cPanel → *Cron Jobs* → nightly `mysqldump`)
