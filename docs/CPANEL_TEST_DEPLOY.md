# Deploying to cPanel Subdomains — Complete Beginner's Guide

Put the **storefront, admin panel and API** on three test subdomains of your
cPanel account, **without touching the WordPress site on your main domain**.

This guide assumes **no prior knowledge**. Every click, every command, and what
you should see after each one.

⏱ **Roughly 1–2 hours** the first time.

> For production on a VPS instead, see [`deploy/README.md`](../deploy/README.md).

---

## Contents

**Understand first**
- [0. Words you'll see (plain English)](#0-words-youll-see-plain-english)
- [1. What we're building](#1-what-were-building)
- [2. The one rule that protects WordPress](#2-the-one-rule-that-protects-wordpress)
- [3. Check your hosting can do this](#3-check-your-hosting-can-do-this)

**Do the setup**
- [4. Log in to cPanel and find your way around](#4-log-in-to-cpanel-and-find-your-way-around)
- [5. Create the three subdomains](#5-create-the-three-subdomains)
- [6. Create the database](#6-create-the-database)
- [7. Open Terminal](#7-open-terminal)
- [8. Download the code onto the server](#8-download-the-code-onto-the-server)
- [9. Create the .env settings file](#9-create-the-env-settings-file)
- [10. Install and build (npm)](#10-install-and-build-npm)
- [11. Set up the database tables](#11-set-up-the-database-tables)
- [12. Start the API](#12-start-the-api)
- [13. Start the storefront](#13-start-the-storefront)
- [14. Publish the admin panel](#14-publish-the-admin-panel)
- [15. Turn on HTTPS (SSL)](#15-turn-on-https-ssl)

**Check and maintain**
- [16. Test everything works](#16-test-everything-works)
- [17. Email (SMTP) — when you're ready](#17-email-smtp--when-youre-ready)
- [18. Updating after a code change](#18-updating-after-a-code-change)
- [19. Troubleshooting](#19-troubleshooting)
- [20. Removing it all](#20-removing-it-all)
- [21. Going live later](#21-going-live-later)

---

## 0. Words you'll see (plain English)

| Word | What it actually means |
|---|---|
| **Domain** | Your website address, e.g. `yourdomain.com` |
| **Subdomain** | A section in front of it, e.g. `shop-test.yourdomain.com`. Behaves like a completely separate website. Free — you can make as many as you like. |
| **Document root** | The folder on the server that a domain shows to visitors. WordPress's is `public_html`. |
| **Database** | Where the shop stores products, orders and customers. WordPress has its own; we make a **new, separate one**. |
| **Terminal** | A black window where you type commands instead of clicking. cPanel has one built in. |
| **npm** | The installer for Node.js projects. `npm install` downloads the code libraries the app needs; `npm run build` turns the source code into something runnable. |
| **Node.js app** | A cPanel feature that keeps a JavaScript program running permanently. The storefront and API each need one. |
| **Passenger** | The background system cPanel uses to run Node.js apps. You never interact with it directly. |
| **SMTP** | The settings needed to send emails (order confirmations). |
| **SSL / HTTPS** | The padlock in the browser. Free via cPanel's AutoSSL. |
| **`.env` file** | A plain text file holding settings and passwords. Never shared or committed to GitHub. |

**Three parts to this app:**

- **Storefront** — the shop customers see
- **Admin panel** — where you manage products and orders
- **API (backend)** — the engine both talk to; customers never see it directly

---

## 1. What we're building

Everywhere below, replace `yourdomain.com` with your real domain.

| Address | What it is |
|---|---|
| `shop-test.yourdomain.com` | The shop |
| `admin-test.yourdomain.com` | The admin panel |
| `api-test.yourdomain.com` | The backend |
| `yourdomain.com` | **Your WordPress site — untouched** |

Folders on the server (`USER` = your cPanel username):

```
/home/USER/public_html/     ← WordPress. WE NEVER TOUCH THIS.
/home/USER/onlinestore/     ← the shop's code
/home/USER/shoptest/        ← storefront web folder
/home/USER/admintest/       ← admin web folder
/home/USER/apitest/         ← API web folder
```

**Why three subdomains instead of one?** On cPanel, each Node.js app must have its
own web address. There's no way to put the backend at `shop-test.yourdomain.com/api`.
So the backend gets its own subdomain.

---

## 2. The one rule that protects WordPress

> ### 🚨 Never type `public_html` anywhere in this guide.

When you create a Node.js app, cPanel writes a hidden file called `.htaccess` into
that app's folder, which says "send all visitors to this Node program instead".

If you pointed a Node app at `public_html`, that file would land on top of
WordPress and **your live site would stop working**.

Every folder in this guide is separate from `public_html`. As long as you don't
type it, WordPress is safe. (And if it ever happens, [§19](#19-troubleshooting)
tells you how to undo it.)

---

## 3. Check your hosting can do this

**You need the "Setup Node.js App" feature.** Log in to cPanel and look for it:

1. Look in the search box at the top of cPanel and type `node`.
2. If **Setup Node.js App** appears → ✅ you're fine, continue.
3. If nothing appears → ❌ stop. Your plan can't run this app.

If it's missing, contact your host and ask: *"Does my plan support Node.js
applications (Node.js Selector / Setup Node.js App)? I need Node.js version 20 or
higher."* Many hosts enable it on request or on a slightly higher plan.

**Also check:** cPanel → search `terminal`. If **Terminal** is missing, ask your
host to enable it, or ask for SSH access. You can *mostly* work without it, but
it makes this dramatically easier.

---

## 4. Log in to cPanel and find your way around

Go to **`https://yourdomain.com/cpanel`** (or `https://yourdomain.com:2083`), and
log in with the username and password from your hosting provider.

**The search box at the very top is the fastest way to find anything.** Rather than
hunting through sections, just type the tool's name. This guide will say things
like *"cPanel → search `MySQL`"* — that means type it in that box.

---

## 5. Create the three subdomains

**cPanel → search `domains` → click Domains** (on older cPanel it's called
**Subdomains** — steps are nearly identical).

### Create the first one

1. Click the blue **Create A Domain** button (top right).
2. In **Domain**, type: `shop-test.yourdomain.com`
3. **⚠️ Important:** if you see a checkbox *"Share document root with
   yourdomain.com"* — **untick it**. It must be unticked. If it stays ticked, this
   subdomain would show WordPress instead.
4. The **Document Root** box will auto-fill with something like
   `/home/USER/shop-test.yourdomain.com`. Change it to simply:

   ```
   /home/USER/shoptest
   ```

   (Either works; the short name just makes later commands easier to type.)
5. Click **Submit**.

You should see a green success message.

### Repeat twice more

| Domain | Document Root |
|---|---|
| `admin-test.yourdomain.com` | `/home/USER/admintest` |
| `api-test.yourdomain.com` | `/home/USER/apitest` |

### Check it worked

Open `http://shop-test.yourdomain.com` in a browser. You should see an empty page,
a file listing, or a "no index page" message — **anything except your WordPress
site.** If you see WordPress, the document root is wrong: delete the subdomain and
redo it with the checkbox unticked.

> **If your DNS is managed elsewhere** (Cloudflare, GoDaddy, Namecheap — i.e. you
> changed nameservers away from your host), also add an **A record** for each
> subdomain pointing to your server's IP address. Find the IP in cPanel's right-hand
> sidebar under *Shared IP Address*. If you use **Cloudflare**, set these three
> records to **DNS only** (grey cloud, not orange) while testing — it makes SSL and
> troubleshooting far simpler.

---

## 6. Create the database

The shop needs its own database — **completely separate from WordPress's.**

**cPanel → search `MySQL` → click MySQL® Databases**

### 6a. Create the database

1. Under **Create New Database**, in the *New Database* box type: `storetest`
2. Notice cPanel shows a prefix, e.g. `bilal_`. The full name becomes
   **`bilal_storetest`**.
3. Click **Create Database**, then **Go Back**.

📝 **Write down the full name including the prefix.**

### 6b. Create the database user

1. Scroll down to **MySQL Users → Add New User**.
2. **Username**: `storeuser` → becomes `bilal_storeuser`
3. **Password**: click **Password Generator**, then **Use Password**.
   📝 **Copy this password somewhere safe now** — it is not shown again.
4. Click **Create User**, then **Go Back**.

### 6c. Give the user access to the database ⚠️

**This step is easy to miss and nothing works without it.**

1. Scroll to **Add User To Database**.
2. **User**: `bilal_storeuser` — **Database**: `bilal_storetest`
3. Click **Add**.
4. On the privileges screen, tick **ALL PRIVILEGES** (the checkbox at the top ticks
   everything).
5. Click **Make Changes**.

### 6d. Write down your connection string

You now have three pieces of information. Put them into this pattern:

```
mysql://bilal_storeuser:YOUR_PASSWORD@localhost:3306/bilal_storetest
             ↑ user          ↑ password              ↑ database name
```

📝 Save this — you'll paste it in [§9](#9-create-the-env-settings-file).

> **If your password contains `@`, `:`, `/`, `#` or `?`**, it will break the
> connection string. Go back to 6b and generate a password with letters and
> numbers only.

---

## 7. Open Terminal

**cPanel → search `terminal` → click Terminal.** Accept any warning.

You'll see a black window ending with something like `[USER@server ~]$`. That's
the **prompt** — it's waiting for you to type.

**How to use it:**

- Type a command, press **Enter**
- Paste with **Ctrl+Shift+V** (Windows/Linux) or **Cmd+V** (Mac)
- No prompt back yet = it's still working. **Wait.**

Three commands worth knowing:

```bash
pwd     # "where am I?"
ls      # "what's in this folder?"
cd ~    # "go back to my home folder"
```

Try it now — type `pwd` and press Enter. It should print `/home/USER`.

---

## 8. Download the code onto the server

We put the code in `/home/USER/onlinestore` — **outside** all the web folders, so
nobody can view your source code through a browser.

### Option A — cPanel's Git tool (recommended)

**cPanel → search `git` → click Git™ Version Control** → **Create**

1. Toggle **Clone a Repository** to ON.
2. **Clone URL**:
   ```
   https://github.com/bilalmughal2000/OnlineStore.git
   ```
3. **Repository Path**:
   ```
   /home/USER/onlinestore
   ```
4. Click **Create**.

**If the repository is private**, cPanel will ask for credentials and a normal
password won't work. Create a token:

1. GitHub → click your avatar → **Settings**
2. Left sidebar, scroll to the bottom → **Developer settings**
3. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
4. Tick the **`repo`** checkbox. Set an expiry. Click **Generate token**.
5. **Copy the token now** — GitHub shows it once.
6. Use your GitHub **username** and paste the **token as the password**.

### Option B — upload a zip

If Git gives you trouble:

1. On your own computer, zip the project folder — **exclude `node_modules`**
   (it's huge and gets rebuilt on the server).
2. cPanel → **File Manager** → navigate to `/home/USER`
3. **Upload** the zip, then right-click it → **Extract**
4. Rename the extracted folder to `onlinestore`.

### Check it worked

In Terminal:

```bash
cd ~/onlinestore
ls
```

You should see: `apps  packages  package.json  README.md  docs  deploy` …

---

## 9. Create the .env settings file

This file holds every setting and password. We'll create it with the built-in text
editor.

### Open the editor

1. **cPanel → File Manager**
2. Navigate into `onlinestore`
3. **Turn on hidden files** — click **Settings** (top right) → tick
   **Show Hidden Files (dotfiles)** → **Save**. Files starting with `.` are hidden
   by default, and `.env` is one of them.
4. Click **+ File** (top left) → name it exactly `.env` → **Create New File**
5. Right-click `.env` → **Edit** → **Edit** again if it warns about encoding

### Paste this in

Replace every `CAPITAL_PLACEHOLDER`:

```bash
NODE_ENV=production

# ── Database — from §6d ─────────────────────────────────────
DATABASE_URL=mysql://bilal_storeuser:YOUR_DB_PASSWORD@localhost:3306/bilal_storetest?connection_limit=5&pool_timeout=20
DIRECT_DATABASE_URL=mysql://bilal_storeuser:YOUR_DB_PASSWORD@localhost:3306/bilal_storetest

# ── Security — see below for how to generate these ──────────
JWT_ACCESS_SECRET=PASTE_RANDOM_STRING_1
JWT_REFRESH_SECRET=PASTE_RANDOM_STRING_2
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
REVALIDATE_SECRET=PASTE_RANDOM_STRING_3

# ── Your addresses — replace yourdomain.com ─────────────────
CORS_ORIGINS=https://shop-test.yourdomain.com,https://admin-test.yourdomain.com
NEXT_PUBLIC_API_URL=https://api-test.yourdomain.com/api
VITE_API_URL=https://api-test.yourdomain.com/api
STOREFRONT_URL=https://shop-test.yourdomain.com

# ── Your first admin login ──────────────────────────────────
SEED_ADMIN_EMAIL=admin@yourdomain.com
SEED_ADMIN_PASSWORD=PickAStrongPassword123

# ── Leave these EXACTLY as they are (empty). See the box below ──
NEXT_PUBLIC_SITE_URL=
SMTP_HOST=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_META_PIXEL_ID=
META_PIXEL_ID=
META_CAPI_ACCESS_TOKEN=
REDIS_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Click **Save Changes**.

### Generate the three random strings

In Terminal, run this three times, pasting a different result into each `JWT_*`
and `REVALIDATE_SECRET` line:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

If that errors with "node: command not found", just invent three long random
strings of 50+ mixed letters and numbers. They only need to be unguessable.

### Protect the file

```bash
chmod 600 ~/onlinestore/.env
```

This stops other accounts on the same server reading your passwords.

---

> ## 🛑 Why those settings must stay empty
>
> Each empty value prevents a specific real-world problem on a **test** site:
>
> | Setting | If you fill it in |
> |---|---|
> | `NEXT_PUBLIC_SITE_URL` | **Google indexes your test shop.** Left empty, the site tells search engines "do not index". Filled in, your test store competes with your real domain in search results. |
> | `SMTP_HOST` | **Real emails go to real people.** Left empty, order emails are written to a log file instead of sent. |
> | Meta / Google IDs | **Fake sales pollute your ad data.** Every test order would report a conversion to Facebook and train your ad targeting on orders that never happened. |
> | `CLOUDINARY_*` | Optional. Empty = uploaded images stored on the server's disk, fine for testing. |
> | `REDIS_URL` | Shared cPanel has no Redis. Empty is correct — the app skips caching cleanly. |
>
> You'll fill these in when going live — [§21](#21-going-live-later).

---

## 10. Install and build (npm)

Two steps: **install** downloads the libraries, **build** compiles the code.

In Terminal:

```bash
cd ~/onlinestore
npm ci
```

**What to expect:** several minutes of scrolling text, ending with something like
`added 411 packages`. Some yellow `warn` lines are normal — ignore them. Only red
`error` lines matter.

> If `npm ci` fails with a lockfile complaint, use `npm install` instead.

Now build:

```bash
npm run build
```

**This takes 3–10 minutes** and prints a lot. Success looks like a table of routes
(`/`, `/checkout`, `/product/[slug]` …).

### ⚠️ If the build is "Killed"

If it stops with just the word `Killed`, your hosting plan ran out of memory. This
is common on cheaper plans. **Build on your own computer instead:**

```bash
# on your own computer, in the project folder
npm ci
npm run build
```

Then zip and upload these folders to the matching places on the server:

```
apps/api/dist/          →  ~/onlinestore/apps/api/dist/
apps/storefront/.next/  →  ~/onlinestore/apps/storefront/.next/
apps/admin/dist/        →  ~/onlinestore/apps/admin/dist/
packages/*/dist/        →  ~/onlinestore/packages/*/dist/
```

(`.next` is hidden — enable *Show Hidden Files* in File Manager to see it.)

---

## 11. Set up the database tables

The database exists but is empty. This creates the tables:

```bash
cd ~/onlinestore
npm run migrate:deploy -w @store/database
```

Expected: `All migrations have been successfully applied.`

Then load demo products so there's something to look at:

```bash
npm run db:seed
```

Expected:

```
✅ Seed complete.
  Admin login: admin@yourdomain.com / PickAStrongPassword123
  Products: 12
```

📝 **Note the admin login it prints** — those are the `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` values from your `.env` ([§9](#9-create-the-env-settings-file)).
That's how you'll sign in to the admin panel. If you left those lines out of
`.env`, it falls back to `admin@store.pk` / `admin12345`.

> ⚠️ `db:seed` **wipes and reloads** catalogue data. Perfect now; never run it once
> you have real orders.

---

## 12. Start the API

**cPanel → search `node` → Setup Node.js App → CREATE APPLICATION**

Fill in exactly:

| Field | Value |
|---|---|
| **Node.js version** | The highest available — must be **20** or higher |
| **Application mode** | **Production** |
| **Application root** | `onlinestore/apps/api` |
| **Application URL** | select `api-test.yourdomain.com` from the dropdown |
| **Application startup file** | `dist/index.js` |

> **Application root has no leading slash** — cPanel adds `/home/USER/` for you.
> And remember [§2](#2-the-one-rule-that-protects-wordpress): never `public_html`.

Click **CREATE**.

### Add the environment variables

Passenger does **not** read your `.env` file automatically — you must add the
settings here too.

Scroll to **Environment variables** → click **ADD VARIABLE** for each row:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | *(paste from your `.env`)* |
| `DIRECT_DATABASE_URL` | *(paste from your `.env`)* |
| `JWT_ACCESS_SECRET` | *(paste)* |
| `JWT_REFRESH_SECRET` | *(paste)* |
| `CORS_ORIGINS` | `https://shop-test.yourdomain.com,https://admin-test.yourdomain.com` |
| `STOREFRONT_URL` | `https://shop-test.yourdomain.com` |
| `REVALIDATE_SECRET` | *(paste)* |

Click **SAVE**, then **RESTART**.

### Check it

Open in a browser: **`https://api-test.yourdomain.com/api/health`**

Expected:

```json
{"status":"ok","time":"2026-08-05T..."}
```

🎉 The backend is live. If not, see [§19](#19-troubleshooting).

---

## 13. Start the storefront

**Setup Node.js App → CREATE APPLICATION** again:

| Field | Value |
|---|---|
| **Node.js version** | **20** or higher |
| **Application mode** | **Production** |
| **Application root** | `onlinestore/apps/storefront` |
| **Application URL** | `shop-test.yourdomain.com` |
| **Application startup file** | `server.js` |

> ⚠️ **`server.js`, not `dist/index.js`.** This file is already in the project — it
> starts Next.js the way cPanel expects.

Environment variables:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_API_URL` | `https://api-test.yourdomain.com/api` |

**SAVE** → **RESTART**.

### Check it

Open **`https://shop-test.yourdomain.com`** — you should see the shop with
products.

---

## 14. Publish the admin panel

The admin is different: **no Node.js app needed.** It's plain files you copy.

Because the backend address gets baked into the admin when it's built, we build it
with that address, then copy the result.

In Terminal:

```bash
cd ~/onlinestore
VITE_API_URL=https://api-test.yourdomain.com/api npm run build:admin
cp -r apps/admin/dist/. ~/admintest/
```

> The `/.` at the end of `dist/.` matters — it copies hidden files too, including
> the `.htaccess` the admin needs. Without it, refreshing a page in the admin gives
> a 404.

Check:

```bash
ls -a ~/admintest
```

You should see `index.html`, `assets`, and `.htaccess`.

Now open **`https://admin-test.yourdomain.com`** and log in with the admin account
the seed printed in [§11](#11-set-up-the-database-tables) — the
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` values from your `.env`.

---

## 15. Turn on HTTPS (SSL)

**cPanel → search `SSL` → SSL/TLS Status**

1. Tick all three test subdomains.
2. Click **Run AutoSSL**.
3. Wait 2–15 minutes and refresh. All three should show a green padlock.

**This is not optional.** Browsers block a secure `https://` page from talking to
an insecure `http://` backend, and the failure is silent — the shop will simply
show no products with no visible error.

> Using Cloudflare's orange cloud? Either switch these three to **DNS only** while
> running AutoSSL, or in Cloudflare set SSL mode to **Full (strict)**.

---

## 16. Test everything works

In Terminal or a browser:

```bash
# backend alive
curl https://api-test.yourdomain.com/api/health

# products returned
curl "https://api-test.yourdomain.com/api/products?pageSize=2"

# test site is hidden from Google — must show "Disallow: /"
curl https://shop-test.yourdomain.com/robots.txt
```

Then click through in a browser:

- [ ] Shop home page shows products
- [ ] Click a product → choose a size → **Add to Cart**
- [ ] Cart shows the right total
- [ ] **Checkout without logging in** — it should only ask for an email
- [ ] Order completes and shows a confirmation page
- [ ] Admin → **Orders** — your order is there with a **GUEST** badge
- [ ] Admin → **Customers & Users** → tick **Guest customers only** → buyer listed
- [ ] Admin → **Products** → edit and save a product
- [ ] ✅ **`https://yourdomain.com` — WordPress still works normally**

No order email arrives — that's correct, `SMTP_HOST` is empty on purpose. The
email content is written to the app's log instead.

---

## 17. Email (SMTP) — when you're ready

Skip this while testing. When you want real order emails:

### Create a mailbox

**cPanel → search `email accounts` → Email Accounts → + Create**

- **Username**: `orders` → gives `orders@yourdomain.com`
- Set a password (📝 save it)
- **Create**

### Find the settings

On the Email Accounts list, click **Connect Devices** next to the new address.
Under **Mail Client Manual Settings** you'll find the outgoing (SMTP) details.

### Add them

Add to `.env` **and** to the API's environment variables in Setup Node.js App:

```bash
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=orders@yourdomain.com
SMTP_PASS=the_mailbox_password
EMAIL_FROM=Aabroo <orders@yourdomain.com>
```

Restart the API. Place a test order using **your own** email address.

> `SMTP_PORT=587` with `SMTP_SECURE=false` is the usual combination. If your host
> specifies port **465**, then set `SMTP_SECURE=true`.

---

## 18. Updating after a code change

```bash
cd ~/onlinestore
git pull                                    # or cPanel → Git → Update from Remote
npm ci                                      # only if dependencies changed
npm run build
npm run migrate:deploy -w @store/database   # only if the database structure changed

# admin only if you changed admin code
VITE_API_URL=https://api-test.yourdomain.com/api npm run build:admin
cp -r apps/admin/dist/. ~/admintest/
```

Then **Setup Node.js App → RESTART** on both applications.

**Restart alone is enough for:** backend code changes.
**A full rebuild is required for:** any storefront or admin change, and **any**
change to a setting starting with `NEXT_PUBLIC_` or `VITE_` — those get compiled
into the files, so restarting does nothing.

---

## 19. Troubleshooting

### 🚨 WordPress stopped working

Almost certainly a Node app or subdomain was pointed at `public_html`.

1. **Setup Node.js App** → find any app whose root is `public_html` → **Destroy**
2. **File Manager** → `public_html` → enable *Show Hidden Files* → look at
   `.htaccess`. If it mentions `Passenger`, delete those lines (or delete the file
   if WordPress's rules aren't in it — WordPress recreates its own).
3. Recreate the app with the correct root from [§12](#12-start-the-api).

### Other problems

| What you see | Why | Fix |
|---|---|---|
| Subdomain shows WordPress | "Share document root" was ticked | Delete the subdomain, recreate with it unticked ([§5](#5-create-the-three-subdomains)) |
| `503 Service Unavailable` | App not started or wrong startup file | Setup Node.js App → **RESTART**; check startup file is `dist/index.js` (API) or `server.js` (storefront) |
| Shop loads but shows no products | Backend address wrong, or SSL not ready | Check `/api/health` in a browser; confirm `NEXT_PUBLIC_API_URL` then **rebuild** |
| Products show in `curl` but not the browser | `CORS_ORIGINS` wrong | Must list both `https://` addresses exactly, on the **API** app. Restart after changing. |
| Admin blank, or 404 when refreshing | `.htaccess` didn't copy | Re-run `cp -r apps/admin/dist/. ~/admintest/` — note the `/.` |
| `Can't reach database server` | Wrong credentials, or §6c skipped | Re-check the prefixed names; confirm the user has ALL PRIVILEGES |
| `PrismaClientInitializationError` | Database driver built for the wrong system | Run `npm run db:generate` **on the server** |
| Build says `Killed` | Out of memory | Build on your computer, upload the results ([§10](#10-install-and-build-npm)) |
| `npm: command not found` | Terminal isn't using the app's Node | Setup Node.js App → copy the **"Enter to the virtual environment"** command shown there, paste it into Terminal, then retry |
| Test site appearing in Google | `NEXT_PUBLIC_SITE_URL` got filled in | Empty it, rebuild, and add **Directory Privacy** on `~/shoptest` |

### Reading the error logs

Setup Node.js App shows a log file path for each app. To watch it live:

```bash
tail -f ~/logs/api-test.yourdomain.com.log
```

Press **Ctrl+C** to stop. Reproduce the problem while it's running — the real
error usually appears there.

---

## 20. Removing it all

1. **Setup Node.js App** → **Destroy** both applications
2. **Domains** → remove the three test subdomains
3. **MySQL® Databases** → delete `bilal_storetest` and `bilal_storeuser`
4. **File Manager** → delete `onlinestore`, `shoptest`, `admintest`, `apitest`

WordPress and `public_html` are unaffected by every one of these.

---

## 21. Going live later

When you're ready for real customers:

1. **Point real domains** at the apps (or move to a VPS — [`deploy/README.md`](../deploy/README.md))
2. **Set `NEXT_PUBLIC_SITE_URL`** to the real address, **then rebuild** — this is
   what allows Google to index the shop
3. **Fill in SMTP** ([§17](#17-email-smtp--when-youre-ready)) so customers get order emails
4. **Fill in Meta/Google tracking** — see [`docs/META_ADS.md`](META_ADS.md)
5. **Set `CLOUDINARY_*`** so product images live on a CDN, not the server disk
6. **Change the admin password** from the seeded one
7. **Do NOT run `db:seed`** — it deletes catalogue data
8. **Set up backups**: cPanel → *Cron Jobs* → a nightly `mysqldump`
