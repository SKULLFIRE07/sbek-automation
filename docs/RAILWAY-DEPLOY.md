# SBEK Automation — Railway Deployment Guide

## Overview

Railway hosts 3 services + 2 add-ons:

| Service | Source | Internal URL |
|---------|--------|-------------|
| **App** (Express API) | Root `Dockerfile` | `app.railway.internal:3000` |
| **Dashboard** (Next.js) | `dashboard/Dockerfile` | `dashboard.railway.internal:3000` |
| **Crawler** (Playwright) | `crawler/Dockerfile` | `crawler.railway.internal:3001` |
| **PostgreSQL** | Railway Add-on | Auto-injected `DATABASE_URL` |
| **Redis** | Railway Add-on | Auto-injected `REDIS_URL` |

Estimated cost: **~$5-10/mo** (Hobby plan) or **free** on trial.

---

## Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `sbek-automation` repository
4. Railway will detect the root Dockerfile — this becomes the **App** service
5. Rename it to `app` in the service settings

---

## Step 2: Add PostgreSQL & Redis

1. In the project dashboard, click **+ New** → **Database** → **Add PostgreSQL**
2. Click **+ New** → **Database** → **Add Redis**
3. Railway auto-injects `DATABASE_URL` and `REDIS_URL` into your services

---

## Step 3: Add Dashboard Service

1. Click **+ New** → **GitHub Repo** → select the same repo
2. In the service settings:
   - **Root Directory**: `dashboard`
   - **Service Name**: `dashboard`
3. Add environment variable:
   - `API_URL` = `http://app.railway.internal:3000`

---

## Step 4: Add Crawler Service

1. Click **+ New** → **GitHub Repo** → select the same repo
2. In the service settings:
   - **Root Directory**: `crawler`
   - **Service Name**: `crawler`
3. No extra env vars needed for the crawler itself

---

## Step 5: Configure Environment Variables

In the **App** service, add these environment variables:

### Required
```
NODE_ENV=production
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<choose-a-strong-password>
CRAWLER_BASE_URL=http://crawler.railway.internal:3001
```

### WooCommerce (already configured)
```
WOO_URL=https://sb-ek.com
WOO_CONSUMER_KEY=<your-consumer-key>
WOO_CONSUMER_SECRET=<your-consumer-secret>
```

### Brand Config
```
BRAND_NAME=SBEK
BRAND_PRIMARY_COLOR=#C5A572
BRAND_WEBSITE=https://sb-ek.com
BRAND_SUPPORT_EMAIL=support@sb-ek.com
```

### Optional (add later)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-gmail>
SMTP_PASS=<app-password>
EMAIL_FROM="SBEK <your-gmail>"
GEMINI_API_KEY=<from-aistudio.google.com>
```

> **Note:** `DATABASE_URL` and `REDIS_URL` are auto-injected by Railway — do NOT set them manually.

---

## Step 6: Run Database Migrations

After first deploy:

1. Go to the **App** service
2. Click **Settings** → **Railway Shell** (or use Railway CLI)
3. Run: `npm run db:migrate`
4. Optionally seed demo data: `npm run seed`

Or via Railway CLI:
```bash
railway run npm run db:migrate
railway run npm run seed
```

---

## Step 7: Set Up Custom Domain (Optional)

1. Go to **App** service → **Settings** → **Networking**
2. Click **Generate Domain** (gives you `*.up.railway.app`)
3. Or add custom domain: `api.sb-ek.com`
4. Do the same for **Dashboard**: `dashboard.sb-ek.com` or `admin.sb-ek.com`

Railway handles SSL automatically.

---

## Step 8: Set Up WooCommerce Webhook

Once deployed, add a webhook in WooCommerce:

1. Go to WooCommerce → Settings → Advanced → Webhooks
2. Add webhook:
   - **Delivery URL**: `https://<your-app-domain>.up.railway.app/webhooks/woocommerce`
   - **Topic**: Order updated
   - **Status**: Active

---

## Architecture on Railway

```
Internet
   │
   ├── https://dashboard-xxx.up.railway.app → Dashboard (Next.js)
   │       │
   │       └── /api/* → (rewrites to) App (Express) via private network
   │
   ├── https://app-xxx.up.railway.app → App (Express API)
   │       │
   │       ├── PostgreSQL (Railway add-on, private)
   │       ├── Redis (Railway add-on, private)
   │       └── Crawler (private network)
   │
   └── WooCommerce webhooks → App /webhooks/woocommerce
```

---

## Useful Railway CLI Commands

```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up

# View logs
railway logs

# Run migrations
railway run npm run db:migrate

# Open shell
railway shell
```

---

## Troubleshooting

- **Build fails**: Check that the Dockerfile context is correct (root for app, `dashboard/` for dashboard)
- **Dashboard can't reach API**: Ensure `API_URL=http://app.railway.internal:3000` is set
- **Database connection fails**: Railway auto-injects `DATABASE_URL` — check it's not manually overridden
- **Crawler timeout**: Playwright needs more memory — upgrade to a paid plan if on free tier
