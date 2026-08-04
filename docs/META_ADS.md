# Meta Ads — Implementation, Setup & Launch Guide

Everything this project does for Facebook/Instagram advertising: what is already
built, what you must supply, how to switch it on, and how to actually run ads.

**Status:** the code is complete and verified. Nothing works until you fill in
five environment variables — see [§3](#3-what-you-must-supply).

---

## Table of contents

1. [How the tracking works](#1-how-the-tracking-works)
2. [What is implemented](#2-what-is-implemented)
3. [What you must supply](#3-what-you-must-supply)
4. [Setup — step by step](#4-setup--step-by-step)
5. [Verifying it works](#5-verifying-it-works)
6. [Running your first campaign](#6-running-your-first-campaign)
7. [Ongoing operation](#7-ongoing-operation)
8. [Troubleshooting](#8-troubleshooting)
9. [Rules that must never be broken](#9-rules-that-must-never-be-broken)
10. [File reference](#10-file-reference)

---

## 1. How the tracking works

Meta needs to know which ad produced which sale. Two independent channels report
that, and they are **both required** — they are not alternatives.

```
                         ┌──────────────────────────┐
   Shopper's browser ───▶│  Meta Pixel (fbevents.js)│───▶ Meta
                         └──────────────────────────┘
                                    ▲
                                    │ blocked by ad-blockers,
                                    │ iOS tracking prevention,
                                    │ network filters, private mode
                                    │
   Your API server  ─────────────────────────────────▶ Meta
                    Conversions API (server-to-server)
                    cannot be blocked by the browser
```

**Why both.** A double-digit share of shoppers block the Pixel. Those are real
sales Meta never learns about, so its optimisation trains on incomplete data and
your reported ROAS is understated — you end up switching off ads that were
actually working.

**Deduplication.** Because a single purchase is reported twice, both messages
carry the same `event_id`:

```
event_id = purchase_<orderId>      e.g. purchase_cmsdm8nt20007j89vrfgll0u6
```

Meta sees the pair, keeps one, and discards the duplicate. This is the single
most important detail in the whole setup — if the two IDs ever stop matching,
**every online sale is counted twice** and your reported ROAS silently doubles.

The IDs are generated from one shared definition:

- Browser: `purchaseEventId()` in `apps/storefront/src/lib/analytics.ts`
- Server: `event_id` in `apps/api/src/lib/meta-capi.ts`

**Catalogue.** Separately, a product feed tells Meta what you sell, so it can
build ads showing the exact item a shopper viewed. See [§2.3](#23-product-catalogue-feed).

---

## 2. What is implemented

### 2.1 Browser Pixel events

Loaded by `apps/storefront/src/components/Analytics.tsx`, fired from
`apps/storefront/src/lib/analytics.ts`.

| Event | When it fires | Data sent |
|---|---|---|
| `PageView` | Every page, including client-side navigation | — |
| `ViewContent` | Product detail page | product id, name, category, price |
| `AddToCart` | Add to cart succeeds | product id, quantity, value, PKR |
| `InitiateCheckout` | Checkout page opens | all line items, cart total |
| **`Purchase`** | Order confirmation page | order total, items, `eventID` |
| `Search` | Search results page | search term |
| `AddToWishlist` | Wishlist heart | product id, price |
| `ViewCategory` | Category / search listing | product ids in view |

Notes on correctness, because these are the things that quietly go wrong:

- **Client-side navigation is handled.** Next.js App Router navigates without a
  document load, so both SDKs would otherwise only ever report the first page of
  a session. A route-change tracker fires `PageView` on every navigation.
- **Events are queued until the SDK is ready.** Scripts load `afterInteractive`,
  which runs *after* React hydration — so a product page's `ViewContent` can fire
  while `window.fbq` is still undefined. A bounded queue buffers those and flushes
  them, instead of dropping exactly the first-pageview events that matter most.
- **`Purchase` is idempotent.** Refreshing the confirmation page, or hitting
  back-then-forward, does not re-report the sale.
- **Values come from the server.** Cart and order events are built from the API's
  response, not from what the page happens to be displaying, so reported revenue
  always equals what was actually charged.
- **Nothing loads when unconfigured.** With the env vars blank, no scripts load
  and no requests are made. Dev environments stay silent.

### 2.2 Conversions API (server-side)

`apps/api/src/lib/meta-capi.ts`, called from the checkout route.

- Sends `Purchase` to `https://graph.facebook.com/v21.0/<PIXEL_ID>/events`
- `action_source: "website"`, `event_id: purchase_<orderId>`
- Customer data is **SHA-256 hashed** before sending — email, phone, first name,
  city, country. Raw PII never leaves the server.
- Pakistani phone numbers are normalised to E.164 (`03001234567` → `923001234567`)
  before hashing, otherwise Meta cannot match them.
- Forwards `fbp` / `fbc` cookies, client IP and user agent to improve match rate.
- **Fire-and-forget.** It is never awaited, so a slow or failing Graph API call
  can never delay or break a customer's checkout.

**Ad-click attribution.** Meta's `_fbc` cookie only exists if the Pixel ran when
the shopper landed — which is exactly what an ad-blocker prevents. So the
storefront captures the `fbclid` from the landing URL itself, stores it for 90
days, and hands it to the API at checkout. Attribution survives even with the
Pixel fully blocked.

### 2.3 Product catalogue feed

`apps/api/src/modules/catalog/feed.routes.ts`

```
GET  <your-domain>/api/feed/products.xml
```

RSS 2.0 with Google's `g:` namespace — the same format serves Meta Commerce
Manager and Google Merchant Center. Cached 10 minutes; refreshed immediately
whenever an admin edits a product.

Fields emitted: `id`, `title`, `description`, `link`, `image_link`,
`additional_image_link`, `availability`, `condition`, `price`, `sale_price`,
`quantity_to_sell_on_facebook`, `brand`, `mpn`, `material`, `gender`,
`age_group`, `google_product_category`, `product_type`, `size`, `color`,
`custom_label_0` (category), `custom_label_1` (`on-sale` / `full-price`).

Behaviour worth knowing:

- **Product-level, not variant-level** — one row per product. This is deliberate;
  see [§9](#9-rules-that-must-never-be-broken).
- `availability` is derived from real variant stock. A product whose variants are
  all at zero is `out of stock`.
- On discount, `price` stays the original and `sale_price` carries the reduced
  one — that is what renders a strikethrough in the ad.
- `size` / `color` are only emitted when a product has exactly one distinct
  value. A product-level row cannot honestly claim one size while stocking five.
- Products with **no image are skipped** and logged. Meta rejects them anyway, so
  submitting them would only pollute your catalogue's error report.
- Descriptions are stripped of HTML and entity-decoded, so shoppers never see
  `&amp;` in an ad.

### 2.4 Also included

- **Google Analytics 4** alongside the Pixel: `view_item`, `add_to_cart`,
  `view_cart`, `begin_checkout`, `purchase`, `search`, `view_item_list`,
  `add_to_wishlist`, `remove_from_cart`.
- **Domain verification tag** — renders `<meta name="facebook-domain-verify">`
  when configured.
- **SEO**: `sitemap.xml`, `robots.txt`, canonical URLs, and product structured
  data with review stars.

---

## 3. What you must supply

Five values in `.env` (plus the domain-verification one). Nothing tracks until
these are set.

```bash
# ── Public site URL ─────────────────────────────────────────
# MUST be your real https:// domain in production.
# While this is localhost, robots.txt returns "Disallow: /" as a safety net.
NEXT_PUBLIC_SITE_URL="https://yourdomain.pk"

# ── Browser Pixel ───────────────────────────────────────────
NEXT_PUBLIC_META_PIXEL_ID="1234567890123456"

# ── Conversions API (server-side) ───────────────────────────
# MUST be the SAME pixel id as above.
META_PIXEL_ID="1234567890123456"
META_CAPI_ACCESS_TOKEN="EAAG...long-token..."

# ── Domain verification ─────────────────────────────────────
NEXT_PUBLIC_META_DOMAIN_VERIFICATION="abc123def456..."

# ── Optional: Google Analytics 4 ────────────────────────────
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-XXXXXXXXXX"

# ── Temporary, for testing only ─────────────────────────────
# Set while validating, then CLEAR IT. Test events are not real conversions.
META_CAPI_TEST_EVENT_CODE=""
```

> **`NEXT_PUBLIC_*` variables are baked in at build time.** After changing any of
> them you must rebuild the storefront (`npm run build:storefront`) and restart.
> Editing `.env` alone changes nothing.

You will also need, on Meta's side:

- A **Facebook Business Manager** account
- An **Ad account** with a payment method (card, or a supported PK method)
- A **Facebook Page** (Instagram account optional but recommended)
- Admin access to your **domain's DNS** or the ability to deploy the meta tag

---

## 4. Setup — step by step

### Step 1 — Business Manager and Page

1. Go to <https://business.facebook.com> and create a Business Manager account.
2. Business Settings → **Accounts → Pages** → add or create your Page.
3. Business Settings → **Accounts → Instagram accounts** → connect (optional,
   but Instagram placements perform well for clothing).
4. Business Settings → **Accounts → Ad accounts** → create one. Set currency to
   **PKR** and the correct time zone (Asia/Karachi) — **neither can be changed
   later**.
5. **Billing** → add a payment method.

### Step 2 — Create the Pixel

1. **Events Manager** → *Connect data sources* → **Web** → **Meta Pixel**.
2. Name it (e.g. "Aabroo Website") and create.
3. Copy the **Pixel ID** (a long number).
4. Put it in `.env` as **both** `NEXT_PUBLIC_META_PIXEL_ID` and `META_PIXEL_ID`.

### Step 3 — Conversions API token

1. Events Manager → your pixel → **Settings**.
2. Scroll to **Conversions API** → *Generate access token*.
3. Copy it into `META_CAPI_ACCESS_TOKEN`.

> Treat this token like a password. It grants the ability to write conversion
> events to your pixel. It lives only in `.env` on the server and is never sent
> to the browser (note it has **no** `NEXT_PUBLIC_` prefix — that is deliberate).

### Step 4 — Verify your domain

1. Business Settings → **Brand Safety → Domains** → add `yourdomain.pk`.
2. Choose the **Meta-tag verification** method.
3. Copy only the `content="..."` value — not the whole tag.
4. Set `NEXT_PUBLIC_META_DOMAIN_VERIFICATION` to that value.
5. Rebuild and deploy, then click **Verify**.

*(A DNS TXT record is the alternative and needs no code change or deploy.)*

Domain verification is required before you can configure Aggregated Event
Measurement, which is what keeps conversion reporting working for iOS traffic.

### Step 5 — Deploy

```bash
npm run build          # builds packages, API, storefront, admin
# restart your processes (PM2, etc.)
```

### Step 6 — Prioritise events (Aggregated Event Measurement)

1. Events Manager → **Aggregated Event Measurement** → *Configure Web Events*.
2. Select your verified domain.
3. Order your 8 events, **most valuable first**:

   ```
   1. Purchase          ← must be #1
   2. InitiateCheckout
   3. AddToCart
   4. ViewContent
   5. Search
   6. AddToWishlist
   ...
   ```

Only the top event is reported for iOS users who opted out of tracking. If
`Purchase` is not first, you lose your most important signal on a large share of
traffic.

### Step 7 — Create the catalogue

1. **Commerce Manager** → *Catalogues* → **Create catalogue** → **E-commerce**.
2. Choose *Upload product info* → **Data feed**.
3. Select **Scheduled feed** and enter:

   ```
   https://yourdomain.pk/api/feed/products.xml
   ```

4. Set the refresh schedule to **Hourly**.
5. Set currency to **PKR**.
6. Wait for the first fetch, then check **Diagnostics** for rejected items.
7. Catalogue → **Settings → Events data source** → connect your Pixel.
   **This step is what links product views to catalogue items** — without it,
   dynamic retargeting has nothing to work from.

### Step 8 — Fill in product attributes

In **Admin → Products → [product] → Shopping Feed**, set:

- **Gender** — Female / Male / Unisex
- **Age Group** — Adult / Kids / etc.
- **Google Product Category** — e.g. `1604` (Apparel & Accessories → Clothing)

Clothing items missing Gender and Age Group are commonly rejected or shown less.
Do this for every product before spending money.

---

## 5. Verifying it works

### 5.1 Pixel — Meta Pixel Helper

Install the [Meta Pixel Helper](https://chromewebstore.google.com/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
Chrome extension, then walk your own site:

| Page | Expect |
|---|---|
| Any page | `PageView` |
| Product page | `PageView` + `ViewContent` |
| Add to cart | `AddToCart` with value and currency |
| Checkout | `InitiateCheckout` |
| After ordering | `Purchase` with the correct total |

### 5.2 Conversions API — Test Events

1. Events Manager → your pixel → **Test Events**, copy the test code.
2. Set `META_CAPI_TEST_EVENT_CODE` in `.env`, rebuild, restart.
3. Place a test order.
4. You should see **two** `Purchase` entries — one *Browser*, one *Server* —
   and Meta should mark them **Deduplicated**.
5. **Clear `META_CAPI_TEST_EVENT_CODE` and redeploy.** Test events are not real
   conversions and will not train optimisation.

### 5.3 Event Match Quality

Events Manager → your pixel → **Overview** → *Event Match Quality*. Aim for
**6.0+** on `Purchase`. Because the server sends hashed email, phone, name, city
and country, this should score well. A low score means Meta cannot connect sales
to the people who saw your ads.

### 5.4 Feed

```bash
curl https://yourdomain.pk/api/feed/products.xml | head -40
```

Then Commerce Manager → Catalogue → **Diagnostics** for rejections.

### 5.5 The critical cross-check

The feed's `g:id` **must** equal the `content_ids` the Pixel sends.

```bash
# a product id from the feed
curl -s https://yourdomain.pk/api/feed/products.xml | grep -m1 "<g:id>"
```

Compare with `content_ids` on a `ViewContent` event in Pixel Helper. They must be
identical strings. If they differ, retargeting silently attributes nothing — no
error, no warning, just zero sales credited.

---

## 6. Running your first campaign

### 6.1 Before spending anything

- [ ] Pixel firing on all pages (Pixel Helper)
- [ ] `Purchase` deduplicated (Test Events shows Browser + Server)
- [ ] Domain verified
- [ ] `Purchase` ranked #1 in Aggregated Event Measurement
- [ ] Catalogue live with **0 critical** diagnostics
- [ ] Catalogue connected to the Pixel (Step 7.7)
- [ ] Gender + Age Group set on every product
- [ ] `META_CAPI_TEST_EVENT_CODE` **cleared**
- [ ] COD ceiling reviewed (Admin → Settings)
- [ ] Stock accurate — every out-of-stock item in the feed buys clicks that cannot convert

### 6.2 Campaign structure to start with

Meta needs roughly **50 conversions per ad set per week** to optimise well. Don't
fragment a small budget across many ad sets.

**Campaign 1 — Prospecting (cold traffic)**

```
Objective:   Sales
Conversion:  Purchase          ← not AddToCart, not Landing Page View
Audience:    Pakistan, 18–45, broad (no interests to begin with)
Placements:  Advantage+ (automatic)
Budget:      Advantage campaign budget
Creative:    4–6 ads — product on a model, flat-lay, carousel, one video
```

Start **broad**. Meta's algorithm outperforms manual interest targeting in most
cases once the Pixel has data, and interest stacking on a small budget starves
the learning phase.

**Campaign 2 — Retargeting (warm traffic)** — start after ~1,000 site visitors

```
Objective:   Sales
Format:      Advantage+ Catalogue Ads
Audience:    Viewed or added to cart in the last 14 days, excluding purchasers
Creative:    Dynamic from the catalogue (shows the exact product they viewed)
```

This is where the catalogue earns its keep, and it is normally the
highest-ROAS campaign in a clothing account.

### 6.3 Budget guidance for a new store

| Phase | Daily budget | Duration | Goal |
|---|---|---|---|
| Learning | PKR 3,000–5,000 | 7 days | Exit the learning phase |
| Scaling | +20–30% per week | ongoing | Keep ROAS above break-even |
| Retargeting | 20–30% of total | ongoing | Convert warm traffic |

**Do not touch the campaign for the first 3–5 days.** Every edit resets the
learning phase and wastes the spend that came before it.

### 6.4 Knowing your break-even

```
Break-even ROAS = 1 / gross margin

Example: a Rs 2,000 item that costs you Rs 1,200
  gross margin    = (2000 − 1200) / 2000 = 0.40
  break-even ROAS = 1 / 0.40             = 2.5
```

Below 2.5× you are losing money on every sale. `costPrice` already exists on
every product, so your true margin is in the admin.

**For COD, adjust for returns.** With a 25% return-to-origin rate, an effective
2.5× target becomes roughly 3.3× on paper.

### 6.5 Creative that works for PK clothing

- Real photos on real people beat flat-lays
- Price visible in the creative — it filters out unqualified clicks
- Say **"Cash on Delivery"** prominently; it is the single biggest trust factor
- Show fabric detail close-up (lawn, chiffon, linen — buyers look for this)
- Video/reels for Instagram placements
- Refresh creative every 2–3 weeks; fatigue is fast in this market

---

## 7. Ongoing operation

**Daily** — check spend and ROAS; check the catalogue for newly out-of-stock
items still running.

**Weekly** — review Event Match Quality; check feed diagnostics; rotate any
creative whose frequency exceeds ~3; compare Meta-reported orders against actual
orders in Admin → Orders.

**Monthly** — recompute break-even ROAS against real margins including returns;
review which categories actually convert.

**Reconciling numbers.** Meta will report more conversions than your admin shows.
That is normal — it attributes view-through and cross-device conversions. Your
admin is the source of truth for revenue; Meta's numbers are for deciding which
ads to keep.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No events at all | `NEXT_PUBLIC_META_PIXEL_ID` unset, or storefront not rebuilt after setting it | Set it and `npm run build:storefront` |
| Pixel works, CAPI silent | `META_PIXEL_ID` / `META_CAPI_ACCESS_TOKEN` unset | Set both; check the API log for `[meta-capi]` |
| **Purchases counted twice** | Pixel IDs differ between browser and server | `META_PIXEL_ID` must equal `NEXT_PUBLIC_META_PIXEL_ID` |
| Retargeting reaches nobody | Feed `g:id` ≠ Pixel `content_ids`, or catalogue not connected to the Pixel | See [§5.5](#55-the-critical-cross-check) and Step 7.7 |
| Many items rejected | Missing Gender / Age Group / images | Fill in the Shopping Feed panel; check Diagnostics |
| Low Event Match Quality | CAPI not running, or `fbp`/`fbc` not reaching the server | Confirm CAPI is enabled; check `attribution` in the checkout request |
| Google indexes nothing | `NEXT_PUBLIC_SITE_URL` still localhost → `robots.txt` blocks everything | Set the real https domain, rebuild |
| Ads run, no sales | Wrong audience, weak creative, or COD friction | Check the funnel: `ViewContent` → `AddToCart` → `Purchase` drop-off |
| Feed shows stale prices | 10-minute cache | Wait, or edit any product to bust the cache |

**Reading server-side logs:**

```bash
grep meta-capi .devlogs/api.log        # local
pm2 logs api | grep meta-capi          # production
```

Success looks like `[meta-capi] Purchase PK12345678001 sent`.

---

## 9. Rules that must never be broken

**1. `META_PIXEL_ID` must equal `NEXT_PUBLIC_META_PIXEL_ID`.**
Deduplication matches on pixel + `event_id`. Different pixels means no dedup, and
every online sale is counted twice — your ROAS looks twice as good as it is and
you scale spend into a loss.

**2. The feed must stay product-level.**
`g:id` is the product id, matching the `content_ids` the Pixel and CAPI send.
Switching the feed to variant-level (one row per size/colour, which many apparel
guides recommend) without also changing the Pixel makes retargeting match
**nothing** — silently. No error appears anywhere.

**3. Never change the `event_id` format on one side only.**
`purchase_<orderId>` is defined in two files and they must agree:
`apps/storefront/src/lib/analytics.ts` and `apps/api/src/lib/meta-capi.ts`.

**4. Clear `META_CAPI_TEST_EVENT_CODE` before going live.**
Test events never count as conversions and will not train optimisation.

**5. Keep the feed honest.**
Every out-of-stock or mispriced item buys clicks that cannot convert. Stock is
already derived from variants automatically — just keep the admin accurate.

---

## 10. File reference

| Path | Purpose |
|---|---|
| `apps/storefront/src/lib/analytics.ts` | All event definitions, GA4 + Pixel fan-out, dedup id, `fbclid` capture |
| `apps/storefront/src/components/Analytics.tsx` | Loads Pixel + GA4; fires page views on client-side navigation |
| `apps/storefront/src/components/ListingAnalytics.tsx` | List/search impression events for server-rendered pages |
| `apps/storefront/src/lib/site.ts` | Canonical site URL used by SEO and Open Graph |
| `apps/api/src/lib/meta-capi.ts` | Conversions API: hashing, payload, dedup, error handling |
| `apps/api/src/modules/catalog/feed.routes.ts` | Product catalogue feed |
| `apps/api/src/modules/orders/orders.routes.ts` | Fires the server-side `Purchase` after checkout |
| `apps/storefront/src/app/layout.tsx` | Domain-verification tag, `metadataBase`, site structured data |
| `apps/admin/src/pages/ProductEditor.tsx` | Shopping Feed panel (gender, age group, category) |
| `.env.example` | Every variable, documented |

---

## Appendix — quick reference

```bash
# Feed
curl https://yourdomain.pk/api/feed/products.xml

# Item count in the feed
curl -s https://yourdomain.pk/api/feed/products.xml | grep -c "<item>"

# Server-side Purchase events
grep meta-capi .devlogs/api.log

# Rebuild after changing any NEXT_PUBLIC_* value
npm run build:storefront
```

**Key URLs**

- Business Manager — <https://business.facebook.com>
- Events Manager — <https://business.facebook.com/events_manager>
- Commerce Manager — <https://business.facebook.com/commerce>
- Ads Manager — <https://business.facebook.com/adsmanager>
