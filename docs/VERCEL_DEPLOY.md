# Deploying to Vercel + Railway — Complete Beginner's Guide

Get the whole shop online:

- **Storefront + Admin panel** → **Vercel** (free)
- **API + MySQL database** → **Railway** (~$5/month, card required)

Every click and command, in order, with what you should see after each one.

⏱ **About 45–60 minutes.**

---

## Contents

- [0. Why two platforms and not one](#0-why-two-platforms-and-not-one)
- [1. What you need before starting](#1-what-you-need-before-starting)
- [2. The order matters — read this](#2-the-order-matters--read-this)
- [3. Generate your secret keys](#3-generate-your-secret-keys)
- [4. Railway: create the database](#4-railway-create-the-database)
- [5. Railway: deploy the API](#5-railway-deploy-the-api)
- [6. Fill the database with tables and demo data](#6-fill-the-database-with-tables-and-demo-data)
- [7. Vercel: deploy the admin panel](#7-vercel-deploy-the-admin-panel)
- [8. Vercel: deploy the storefront](#8-vercel-deploy-the-storefront)
- [9. Connect everything (CORS)](#9-connect-everything-cors)
- [10. Test it all works](#10-test-it-all-works)
- [11. Settings cheat-sheet](#11-settings-cheat-sheet)
- [12. Troubleshooting](#12-troubleshooting)
- [13. Moving to cPanel later](#13-moving-to-cpanel-later)
- [14. Going live for real](#14-going-live-for-real)

---

## 0. Why two platforms and not one

**Vercel cannot host your database or your API.**

- Vercel sells no MySQL. None. Your app uses MySQL, so the database must live elsewhere.
- Vercel runs *serverless functions* — small programs that start on each request
  and disappear. Your API is a normal always-running server, and three things
  break under that model: database connections get exhausted, login rate limiting
  stops counting correctly, and image uploads fail on a read-only filesystem.

Vercel is superb at the other two parts — a Next.js storefront and a static admin
panel are exactly what it's built for.

So: **Railway runs the API and database. Vercel runs the two front-ends.**

> ⚠️ **Don't substitute Render for Railway.** Render offers PostgreSQL only — no
> MySQL — so you'd still need a database elsewhere.

---

## 1. What you need before starting

- **A GitHub account** with this project pushed to it
- **A Vercel account** — free, no card ([vercel.com](https://vercel.com), sign in with GitHub)
- **A Railway account** — [railway.app](https://railway.app), sign in with GitHub.
  **A card is required.** Railway ended its free tier in 2023: you get a small
  one-time trial credit, then it's about **$5/month**.
- **Node.js installed on your own computer** — needed once, in [§6](#6-fill-the-database-with-tables-and-demo-data),
  to create the database tables. Check by opening Terminal/Command Prompt and typing:
  ```bash
  node --version
  ```
  If that prints a version number (v20 or higher), you're set. Otherwise install
  from [nodejs.org](https://nodejs.org).

📝 **Keep a notepad open.** You'll collect five values as you go:

```
1. DATABASE_URL       (from §4)
2. JWT_ACCESS_SECRET  (from §3)
3. JWT_REFRESH_SECRET (from §3)
4. REVALIDATE_SECRET  (from §3)
5. API URL            (from §5)
```

---

## 2. The order matters — read this

**The API's address gets baked into the storefront and admin when they are built.**
It is not looked up while the site runs. Build them before the API exists and
they'll point at nothing.

```
Database  →  API  →  (now you have the API URL)  →  Admin  →  Storefront  →  CORS
```

If you already started a Vercel project and it failed — that's fine. You'll add
the missing setting and click **Redeploy**.

---

## 3. Generate your secret keys

These sign your login tokens. They must be long and random — never real words.

Open Terminal (Mac) or Command Prompt (Windows) and run this **three times**:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Each run prints a long line of letters and numbers. Save them as:

```
JWT_ACCESS_SECRET  = (first result)
JWT_REFRESH_SECRET = (second result)
REVALIDATE_SECRET  = (third result)
```

They must be **different from each other**. If `node` isn't installed yet, invent
three random 60-character strings instead.

---

## 4. Railway: create the database

1. Go to [railway.app](https://railway.app) → **Login with GitHub**
2. Click **New Project**
3. Choose **Deploy MySQL** (or *Provision MySQL* / *Add MySQL* — wording varies)
4. Wait ~30 seconds for it to turn green
5. Click the **MySQL** box → **Variables** tab
6. Find **`MYSQL_PUBLIC_URL`** and copy it

> ⚠️ **Copy `MYSQL_PUBLIC_URL`, not `MYSQL_URL`.** The public one works from your
> own computer, which you need in [§6](#6-fill-the-database-with-tables-and-demo-data).
> If you only see `MYSQL_URL`, look for a **Connect** / **Public Networking**
> option to expose a public address.

It looks like this:

```
mysql://root:aBcD1234@monorail.proxy.rlwy.net:34567/railway
```

📝 **Save it as `DATABASE_URL`.**

---

## 5. Railway: deploy the API

Stay in the same Railway project.

1. Click **+ New** (or **Create**) → **GitHub Repo**
2. Authorise Railway to see your GitHub if it asks
3. Pick your **OnlineStore** repository

Railway will immediately try to build and **fail**. That's expected — it doesn't
know how to build this project yet. Fix that now.

### 5a. Tell Railway how to build it

Click the new service → **Settings** tab:

| Setting | Value |
|---|---|
| **Root Directory** | *leave empty* |
| **Build Command** | `npm ci && npm run build:api` |
| **Start Command** | `node apps/api/dist/index.js` |

### 5b. Add the settings

Go to the **Variables** tab → **New Variable** (or **Raw Editor** to paste them all
at once):

```
NODE_ENV=production
DATABASE_URL=<paste from §4>
DIRECT_DATABASE_URL=<paste the same value again>
JWT_ACCESS_SECRET=<from §3>
JWT_REFRESH_SECRET=<from §3>
REVALIDATE_SECRET=<from §3>
CORS_ORIGINS=http://localhost:3000
REDIS_URL=
SMTP_HOST=
```

`CORS_ORIGINS` is a placeholder for now — you'll set the real value in
[§9](#9-connect-everything-cors) once you know your Vercel addresses.

Leave `REDIS_URL` and `SMTP_HOST` **empty**:
- **Redis** — not needed; the app skips caching cleanly without it
- **SMTP** — empty means order emails are written to the log instead of being
  sent, so test orders can't email real people

### 5c. Give it a web address

**Settings** → scroll to **Networking** → **Generate Domain**

You'll get something like `online-store-production.up.railway.app`.

### 5d. Check it works

Open this in your browser, replacing with your address:

```
https://YOUR-APP.up.railway.app/api/health
```

You should see:

```json
{"status":"ok","time":"2026-08-05T..."}
```

🎉 The API is live.

📝 **Save your API base URL** — it's that address **plus `/api`**:

```
https://online-store-production.up.railway.app/api
```

You'll paste this into both Vercel projects.

> **Not working?** Click **Deployments** → the latest one → **View Logs**. The real
> error is there. See [§12](#12-troubleshooting).

---

## 6. Fill the database with tables and demo data

The database exists but is completely empty — no tables. We create them from your
own computer.

Open Terminal in the project folder.

**Mac / Linux:**

```bash
cd ~/Documents/Projects/OnlineStore

export DATABASE_URL="mysql://root:PASSWORD@monorail.proxy.rlwy.net:34567/railway"
export DIRECT_DATABASE_URL="$DATABASE_URL"
export SEED_ADMIN_EMAIL="admin@yourdomain.com"
export SEED_ADMIN_PASSWORD="ChooseAStrongPassword123"

npm run migrate:deploy -w @store/database
npm run db:seed
```

**Windows (PowerShell):**

```powershell
cd C:\path\to\OnlineStore

$env:DATABASE_URL="mysql://root:PASSWORD@monorail.proxy.rlwy.net:34567/railway"
$env:DIRECT_DATABASE_URL=$env:DATABASE_URL
$env:SEED_ADMIN_EMAIL="admin@yourdomain.com"
$env:SEED_ADMIN_PASSWORD="ChooseAStrongPassword123"

npm run migrate:deploy -w @store/database
npm run db:seed
```

Expected output:

```
All migrations have been successfully applied.

🌱 Seeding database...
✅ Seed complete.
  Admin login: admin@yourdomain.com / ChooseAStrongPassword123
  Products: 12
```

📝 **Write down that admin login** — it's how you'll sign in to the admin panel.

> ⚠️ `db:seed` **erases and reloads** all catalogue data. Perfect on a fresh
> database; never run it once you have real orders.

**Verify:** reopen `https://YOUR-APP.up.railway.app/api/products?pageSize=2` —
you should now see product data instead of an empty list.

---

## 7. Vercel: deploy the admin panel

Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import your
**OnlineStore** repository.

| Setting | Value |
|---|---|
| **Project Name** | `online-store-admin` |
| **Framework Preset** | **Vite** |
| **Root Directory** | click **Edit** → choose `apps/admin` |
| **Build Command** | leave as-is |
| **Output Directory** | leave as-is (`dist`) |
| **Install Command** | leave as-is (`npm install --prefix=../..`) |

**The defaults are correct here** — the admin doesn't need any build command
override.

### ⚠️ Add this one variable before deploying

Expand **Environment Variables** and add:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://YOUR-APP.up.railway.app/api` |

**This is the step everyone misses.** Without it the admin panel loads but can
never reach the API. It's compiled into the files at build time, so adding it
afterwards requires a **Redeploy**, not just a save.

Click **Deploy**, wait ~2 minutes.

📝 **Save the address** it gives you, e.g. `online-store-admin.vercel.app`.

Visiting it now shows a login page. It won't log in yet — CORS comes in
[§9](#9-connect-everything-cors).

---

## 8. Vercel: deploy the storefront

**Add New** → **Project** → import the **same repository again**. (Yes, the same
repo — two projects from one repo is normal.)

| Setting | Value |
|---|---|
| **Project Name** | `online-store` |
| **Framework Preset** | **Next.js** |
| **Root Directory** | click **Edit** → choose `apps/storefront` |
| **Build Command** | ⚠️ **override** → `cd ../.. && npm run build:storefront` |
| **Output Directory** | leave as-is |
| **Install Command** | leave as-is |

### ⚠️ Why the build command must be changed here

The storefront uses a shared code package that has to be compiled **before**
Next.js builds. The default command skips that and the deploy fails with:

```
Module not found: Can't resolve '@store/shared-types'
```

(The admin didn't need this because it reads that package's source directly.)

### Environment variables

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-APP.up.railway.app/api` |
| `STOREFRONT_URL` | `https://online-store.vercel.app` *(fill in after the first deploy)* |
| `REVALIDATE_SECRET` | *(the same value you gave Railway in §5b)* |
| `NEXT_PUBLIC_SITE_URL` | **leave empty** — see below |

> 🛑 **Leave `NEXT_PUBLIC_SITE_URL` empty while testing.**
> While it's empty the site tells Google "do not index me". Fill it in and your
> test shop can start appearing in search results, competing with your real
> website. Set it only when you go live — and redeploy, since it's baked in.

Click **Deploy**.

📝 Save the address, e.g. `online-store.vercel.app`.

---

## 9. Connect everything (CORS)

Your API currently refuses requests from your two new Vercel addresses, because
browsers block cross-site requests unless the server explicitly allows them.

Go to **Railway → your API service → Variables** and update:

```
CORS_ORIGINS=https://online-store.vercel.app,https://online-store-admin.vercel.app
STOREFRONT_URL=https://online-store.vercel.app
```

Rules that matter:
- Include `https://`
- **No** trailing slash
- Separate with a comma, **no spaces**
- Use your real addresses

Railway redeploys automatically (~1 minute).

> **This is the number one cause of "the API works but my site shows nothing".**
> If products appear via a direct URL but not on the shop, this variable is wrong.

---

## 10. Test it all works

In your browser:

```
https://YOUR-APP.up.railway.app/api/health          → {"status":"ok",...}
https://YOUR-APP.up.railway.app/api/products        → product data
https://online-store.vercel.app/robots.txt          → must say "Disallow: /"
```

Then click through:

- [ ] Storefront shows products
- [ ] Click a product → pick a size → **Add to Cart**
- [ ] Cart shows the right total
- [ ] **Checkout without logging in** — asks only for an email
- [ ] Order completes, confirmation page appears
- [ ] Admin panel logs in with the account from [§6](#6-fill-the-database-with-tables-and-demo-data)
- [ ] Admin → **Orders** → your order is there with a **GUEST** badge
- [ ] Admin → **Customers & Users** → tick **Guest customers only** → buyer listed
- [ ] Admin → **Products** → edit and save a product

No order email arrives — correct, `SMTP_HOST` is empty on purpose.

---

## 11. Settings cheat-sheet

**Railway — API**
```
Root Directory:  (empty)
Build Command:   npm ci && npm run build:api
Start Command:   node apps/api/dist/index.js
Variables:       NODE_ENV, DATABASE_URL, DIRECT_DATABASE_URL,
                 JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, REVALIDATE_SECRET,
                 CORS_ORIGINS, STOREFRONT_URL
```

**Vercel — Admin**
```
Framework:       Vite
Root Directory:  apps/admin
Build Command:   (default)
Variables:       VITE_API_URL
```

**Vercel — Storefront**
```
Framework:       Next.js
Root Directory:  apps/storefront
Build Command:   cd ../.. && npm run build:storefront
Variables:       NEXT_PUBLIC_API_URL, STOREFRONT_URL, REVALIDATE_SECRET,
                 NEXT_PUBLIC_SITE_URL (empty while testing)
```

### Redeploy vs restart

Anything beginning `NEXT_PUBLIC_` or `VITE_` is **compiled into the files**.
Changing it in the dashboard does nothing until you click **Redeploy**.
Railway variables apply on restart, which happens automatically.

---

## 12. Troubleshooting

| What you see | Why | Fix |
|---|---|---|
| `Module not found: Can't resolve '@store/shared-types'` | Storefront build command not overridden | Set it to `cd ../.. && npm run build:storefront`, redeploy |
| Admin page is blank | `VITE_API_URL` missing | Add it, then **Redeploy** ([§7](#7-vercel-deploy-the-admin-panel)) |
| Console shows CORS errors | `CORS_ORIGINS` wrong | Exact `https://` addresses, no trailing slash ([§9](#9-connect-everything-cors)) |
| Shop loads, no products | `NEXT_PUBLIC_API_URL` wrong, or set after building | Fix it, then **Redeploy** |
| `Table 'Product' doesn't exist` | Migrations never ran | [§6](#6-fill-the-database-with-tables-and-demo-data) |
| `Can't reach database server` from your computer | Used `MYSQL_URL` instead of `MYSQL_PUBLIC_URL` | Copy the public one ([§4](#4-railway-create-the-database)) |
| Railway build fails | Build command wrong | `npm ci && npm run build:api` ([§5a](#5a-tell-railway-how-to-build-it)) |
| Railway deploys, then crashes | Missing variables — usually `DATABASE_URL` | Check **Deployments → View Logs** |
| Product images disappear after a redeploy | No Cloudinary; Railway's disk is wiped on deploy | See the note below |
| Test shop appearing in Google | `NEXT_PUBLIC_SITE_URL` got filled in | Empty it, redeploy |

**Where the logs are:**
- Railway → your service → **Deployments** → **View Logs**
- Vercel → your project → **Deployments** → click one → **Build Logs** / **Runtime Logs**

> ### 💡 Set up Cloudinary early
> Uploaded product images are saved to the server's disk when Cloudinary isn't
> configured — and **Railway wipes that disk on every redeploy**, so your images
> vanish. [Cloudinary](https://cloudinary.com) has a free tier. Add
> `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` to
> Railway's variables and images live on a CDN instead — and follow you if you
> ever change hosts.

---

## 13. Moving to cPanel later

If you move the API and database to cPanel later, **no code changes are needed.**
The app already supports both:

- The API reads whatever port the host gives it (Railway and cPanel both set `PORT`)
- The same `dist/index.js` is the entry point on both
- The database driver is already built for both platforms
- A Passenger startup file for cPanel (`apps/storefront/server.js`) is already in the repo

What you'd actually do:

1. **Copy the data across:**
   ```bash
   mysqldump --no-tablespaces -h <railway-host> -P <port> -u root -p railway > backup.sql
   ```
   then import it in cPanel → **phpMyAdmin**
2. **Update the API's settings** — `DATABASE_URL`, `CORS_ORIGINS`, `STOREFRONT_URL`
3. **⚠️ Redeploy both Vercel projects** after changing `NEXT_PUBLIC_API_URL` and
   `VITE_API_URL` — they're compiled in, so the old address sticks until you rebuild

Full instructions: [docs/CPANEL_TEST_DEPLOY.md](CPANEL_TEST_DEPLOY.md)

---

## 14. Going live for real

1. **Add your own domain** — Vercel → project → **Settings → Domains**
2. **Set `NEXT_PUBLIC_SITE_URL`** to that domain and **redeploy** — this is what
   allows Google to index the shop
3. **Update `CORS_ORIGINS`** on Railway to the real domains
4. **Set up SMTP** so customers actually receive order emails
5. **Add Cloudinary** so images survive redeploys
6. **Add Meta/Google tracking** — see [docs/META_ADS.md](META_ADS.md)
7. **Change the admin password** from the seeded one
8. **Never run `db:seed` again** — it erases catalogue data
9. **Set up backups** — Railway → MySQL service → **Backups**
