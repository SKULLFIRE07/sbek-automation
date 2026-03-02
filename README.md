# SBEK Automation

**End-to-end operations and marketing automation for a luxury Indian jewelry brand.**

Connects a WooCommerce storefront to Google Sheets, WhatsApp, Email, OpenAI, Postiz, and a Playwright-based competitor crawler. Handles the full lifecycle from order intake through production tracking, quality control, customer communications, review collection, SEO/AEO content generation, ad creative generation, social media scheduling, and competitor monitoring -- all driven by event-based queues and cron jobs.

Built with TypeScript, Express, BullMQ, Redis, PostgreSQL, and Docker.

---

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [API Credentials Setup](#api-credentials-setup)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Development](#development)
- [Scripts](#scripts)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)
- [Tech Stack](#tech-stack)

---

## Architecture

```
                       WooCommerce Store
                             |
                   Webhooks (order/product)
                             |
                             v
                  +---------------------+
                  |   Express Server    |
                  |   (Helmet, CORS,    |
                  |    Rate Limiting)   |
                  +---------------------+
                             |
               Validate signature, enqueue job
                             |
                             v
                  +---------------------+
                  |    BullMQ Queues    |
                  |    (7 queues,       |
                  |     Redis-backed)   |
                  +---------------------+
                             |
           +---------+-------+-------+---------+
           |         |       |       |         |
           v         v       v       v         v
     +---------+ +-------+ +-----+ +--------+ +----------+
     | Order   | |Notify | |Review| |Content| |Creative  |
     | Sync    | |Worker | |Worker| |Gen    | |Gen       |
     | Worker  | |       | |      | |Worker | |Worker    |
     +---------+ +-------+ +-----+ +--------+ +----------+
           |         |       |       |         |
           v         v       v       v         v
     +---------+ +-------+ +-----+ +---------+ +----------+
     | Google  | |WhatsApp| |Email| |OpenRouter| | Gemini  |
     | Sheets  | | Cloud  | |SMTP | | (Text)  | | (Image) |
     +---------+ +-------+ +-----+ +---------+ +----------+
                                                    |
                      +-----------------------------+
                      |                             |
                      v                             v
               +------------+              +--------------+
               | Social     |              | Competitor   |
               | Posting    |              | Crawl Worker |
               | Worker     |              |              |
               +------------+              +--------------+
                      |                             |
                      v                             v
               +------------+              +--------------+
               | Postiz API |              | Crawler      |
               |            |              | Microservice |
               +------------+              | (Playwright) |
                                           +--------------+

     +-----------------------------------------------------+
     |              Cron Scheduler (node-cron)              |
     | Daily: Sheets sync, Review requests                  |
     | Weekly: Content generation, Competitor crawl         |
     +-----------------------------------------------------+

     +-----------------------------------------------------+
     |              PostgreSQL (Drizzle ORM)                |
     | Tables: job_logs, webhook_events, cron_runs,         |
     |         competitor_snapshots, system_config           |
     +-----------------------------------------------------+
```

---

## Features

### Operations
- **Order Sync** -- WooCommerce webhooks auto-sync orders to Google Sheets (17-column tracker with jewelry-specific fields)
- **Production Tracking** -- Assign craftspeople, track fabrication stages, send internal WhatsApp briefs
- **Quality Control** -- 6-point inspection checklist with pass/fail/rework logic
- **Customer Communications** -- Automated WhatsApp + Email at every order milestone (6 branded HTML templates)
- **Review Collection** -- 5-day delayed review requests after delivery with daily cron safety net

### Marketing
- **SEO/AEO Content** -- OpenRouter (Gemini 2.5 Flash) generates meta titles, descriptions, FAQs (JSON-LD), AEO knowledge base articles, and comparison content; pushes directly to WooCommerce as Yoast-compatible fields
- **Ad Creatives** -- Gemini generates product images in 5 variants (white background, lifestyle, festive, minimal text, story format)
- **Social Scheduling** -- Auto-posts approved creatives to Instagram/Facebook via Postiz with AI-generated captions
- **Competitor Monitoring** -- Playwright crawler scrapes competitor sites weekly, AI analyzes changes, alerts on significant moves

### Dashboard
- **Real-time Admin Dashboard** -- Next.js 15 app (port 3002) with live queue monitoring, job activity feed, system health overview, and cron job status
- **Settings Management** -- Configure API keys (BYOK), notification channels, cron schedules, and brand settings from the UI
- **Queue Inspector** -- Drill into individual queues to view active, completed, failed, and delayed jobs

### Infrastructure
- **7 BullMQ queues** with independent concurrency, retry counts, and exponential backoff
- **4 cron jobs** (daily sheets sync, daily review requests, weekly content generation, weekly competitor crawl)
- **HMAC-SHA256 webhook verification** with timing-safe comparison
- **3-tier rate limiting** (API, webhook, crawler)
- **Graceful shutdown** (drain queues, close connections on SIGTERM/SIGINT)
- **Spreadsheet injection prevention** on all Google Sheets writes
- **Structured JSON logging** via Pino with pretty-print in dev

---

## Prerequisites

| Tool             | Minimum Version | Purpose                              |
|------------------|-----------------|--------------------------------------|
| Docker           | 20+             | Container runtime                    |
| Docker Compose   | v2+             | Multi-service orchestration          |
| Node.js          | 20+             | Runtime for local development        |
| npm              | 9+              | Package manager (ships with Node.js) |

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/SKULLFIRE07/sbek-automation.git
cd sbek-automation

# 2. Create your environment file
cp .env.example .env
# Open .env in your editor and fill in ALL credentials (see API Credentials Setup)

# 3. Run the one-command setup
chmod +x scripts/initial-setup.sh
./scripts/initial-setup.sh
```

The setup script will:

1. Verify prerequisites (Docker, Node.js, npm)
2. Install dependencies (`npm install`)
3. Compile TypeScript (`npm run build`)
4. Start Docker services (PostgreSQL, Redis, app, crawler)
5. Run database migrations
6. Set up Google Sheets tabs (if credentials are configured)

After setup completes:

```bash
# 4. Register WooCommerce webhooks
npx tsx scripts/register-webhooks.ts

# 5. Verify everything is working
chmod +x scripts/test-webhooks.sh
./scripts/test-webhooks.sh
```

**Endpoints available after setup:**

| Endpoint                             | Description          |
|--------------------------------------|----------------------|
| `http://localhost:3000/health`       | Liveness check       |
| `http://localhost:3000/health/ready` | Deep readiness check |
| `http://localhost:3000/jobs/status`  | Queue job counts     |
| `http://localhost:3001/health`       | Crawler health check |
| `http://localhost:3002`              | Admin dashboard      |

---

## API Credentials Setup

You need credentials from **6 services**. Each section below walks through the setup.

<details>
<summary><strong>WooCommerce REST API</strong></summary>

1. Log in to your WordPress admin panel
2. Go to **WooCommerce > Settings > Advanced > REST API**
3. Click **Add key**
4. Set the description to `SBEK Automation`, permissions to **Read/Write**
5. Click **Generate API key**
6. Copy the **Consumer Key** (`ck_...`) and **Consumer Secret** (`cs_...`)
7. Choose a random string for the webhook secret (used to verify incoming webhooks)
8. Add to `.env`:
   ```
   WOO_URL=https://your-store.com
   WOO_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxx
   WOO_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxx
   WOO_WEBHOOK_SECRET=your_random_secret_string
   ```
</details>

<details>
<summary><strong>Google Account (Sheets + Drive)</strong></summary>

**Option A: OAuth2 (Recommended)** — Connect your Gmail account directly

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable these APIs:
   - **Google Sheets API**
   - **Google Drive API**
4. Go to **APIs & Services > OAuth consent screen**
   - Select **External**, fill in app name
   - Add test users (your Gmail address)
5. Go to **APIs & Services > Credentials**
   - Click **Create Credentials > OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Add redirect URI: `http://localhost:3000/auth/google/callback`
6. Copy the **Client ID** and **Client Secret**
7. Create a Google Spreadsheet and copy the Sheet ID from the URL
8. Add to `.env`:
    ```
    GOOGLE_OAUTH_CLIENT_ID=your_client_id.apps.googleusercontent.com
    GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
    GOOGLE_SHEET_ID=your_spreadsheet_id_here
    ```
9. Start the backend, then go to **Dashboard > Settings > Google Account** and click **Connect Google Account**

**Option B: Service Account (Fallback)**

1. Go to **IAM & Admin > Service Accounts** in Google Cloud Console
2. Create a service account, download the JSON key
3. Share the spreadsheet with the service account email (Editor access)
4. Add to `.env`:
    ```
    GOOGLE_SERVICE_ACCOUNT_EMAIL=sbek-bot@your-project.iam.gserviceaccount.com
    GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
    GOOGLE_SHEET_ID=your_spreadsheet_id_here
    ```
</details>

<details>
<summary><strong>Meta WhatsApp Business Cloud API</strong></summary>

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app (type: **Business**)
3. Add the **WhatsApp** product to your app
4. In the WhatsApp section, go to **API Setup**
5. Copy the **Phone number ID** and **Temporary access token**
   - For production, generate a permanent System User token from Business Manager
6. Create message templates in **WhatsApp Manager** (see `src/templates/whatsapp/templates.json` for the exact templates needed):
   - `order_confirmation` (UTILITY)
   - `production_started` (UTILITY)
   - `qc_passed` (UTILITY)
   - `order_shipped` (UTILITY)
   - `order_delivered` (UTILITY)
   - `review_request` (MARKETING)
   - `production_brief` (UTILITY, internal)
   - `qc_failed_alert` (UTILITY, internal)
7. Submit templates for approval (typically approved within minutes for UTILITY templates)
8. Add to `.env`:
   ```
   WHATSAPP_PHONE_NUMBER_ID=123456789012345
   WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxx
   WHATSAPP_API_VERSION=v21.0
   ```
</details>

<details>
<summary><strong>Gmail SMTP (Email)</strong></summary>

1. Log in to your Gmail account
2. Go to **Google Account > Security**
3. Enable **2-Step Verification** (required for app passwords)
4. Go to **Security > 2-Step Verification > App passwords**
5. Select app: **Mail**, device: **Other** (enter "SBEK Automation")
6. Click **Generate** and copy the 16-character password
7. Add to `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=xxxx_xxxx_xxxx_xxxx
   EMAIL_FROM="SBEK <orders@sbek.com>"
   ```

> **Note:** For production, consider using a transactional email service (SendGrid, AWS SES, Mailgun) instead of Gmail SMTP, which has a 500 emails/day limit.
</details>

<details>
<summary><strong>OpenRouter (Text Generation)</strong></summary>

1. Go to [openrouter.ai](https://openrouter.ai/)
2. Sign up and navigate to **Keys**
3. Click **Create Key**
4. Copy the key (starts with `sk-or-`)
5. Add credits to your account (supports many models including Gemini, AI, Claude, etc.)
6. Add to `.env`:
   ```
   OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxxxxxxxxxxxxx
   ```

> OpenRouter is used for all text generation: SEO meta, FAQs, captions, and competitor analysis. Default model: `google/gemini-2.5-flash`.
</details>

<details>
<summary><strong>Gemini (Image Generation)</strong></summary>

1. Go to [aistudio.google.com](https://aistudio.google.com/)
2. Click **Get API key** > **Create API key**
3. Copy the API key
4. Add to `.env`:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   ```

> Gemini is used exclusively for product image generation (Nano Banana). The model used is `gemini-2.0-flash-preview-image-generation`.
</details>

<details>
<summary><strong>Postiz (Social Media Scheduling)</strong></summary>

1. Sign up at [postiz.com](https://postiz.com/)
2. Connect your Instagram and/or Facebook accounts in Postiz settings
3. Go to **Settings > API** and generate an API key
4. Add to `.env`:
   ```
   POSTIZ_API_KEY=your_postiz_api_key
   POSTIZ_BASE_URL=https://app.postiz.com/api/v1
   ```
</details>

---

## Environment Variables

Full reference of all environment variables. Copy `.env.example` to `.env` and fill in your values.

<details>
<summary><strong>View all environment variables</strong></summary>

### Server

| Variable     | Required | Default       | Description                         |
|-------------|----------|---------------|-------------------------------------|
| `NODE_ENV`  | No       | `development` | `development`, `production`, `test` |
| `PORT`      | No       | `3000`        | HTTP server port                    |
| `LOG_LEVEL` | No       | `info`        | Pino log level                      |

### PostgreSQL

| Variable             | Required | Default | Description            |
|---------------------|----------|---------|------------------------|
| `POSTGRES_DB`       | No       | `sbek`  | Database name          |
| `POSTGRES_USER`     | No       | `sbek`  | Database user          |
| `POSTGRES_PASSWORD` | Yes      | --      | Database password      |
| `DATABASE_URL`      | Yes      | --      | Full connection string |

### Redis

| Variable    | Required | Default                  | Description          |
|------------|----------|--------------------------|----------------------|
| `REDIS_URL` | No      | `redis://localhost:6379` | Redis connection URL |

### WooCommerce

| Variable              | Required | Description                           |
|----------------------|----------|---------------------------------------|
| `WOO_URL`            | Yes      | Store URL (e.g., `https://sbek.in`)   |
| `WOO_CONSUMER_KEY`   | Yes      | REST API consumer key (`ck_...`)      |
| `WOO_CONSUMER_SECRET`| Yes      | REST API consumer secret (`cs_...`)   |
| `WOO_WEBHOOK_SECRET` | Yes      | Shared secret for webhook HMAC        |

### Google (Sheets + Drive)

| Variable                       | Required | Description                                  |
|-------------------------------|----------|----------------------------------------------|
| `GOOGLE_OAUTH_CLIENT_ID`      | No*      | OAuth2 client ID (preferred auth method)     |
| `GOOGLE_OAUTH_CLIENT_SECRET`  | No*      | OAuth2 client secret                         |
| `GOOGLE_OAUTH_REFRESH_TOKEN`  | No*      | Set automatically after OAuth flow           |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`| No*      | Service account email (fallback auth)        |
| `GOOGLE_PRIVATE_KEY`          | No*      | PEM-encoded private key (fallback auth)      |
| `GOOGLE_SHEET_ID`             | Yes      | Spreadsheet ID from URL                      |

> *Either OAuth credentials or service account credentials are required.

### WhatsApp Business Cloud API

| Variable                    | Required | Default | Description     |
|----------------------------|----------|---------|-----------------|
| `WHATSAPP_PHONE_NUMBER_ID` | Yes      | --      | Phone number ID |
| `WHATSAPP_ACCESS_TOKEN`    | Yes      | --      | Bearer token    |
| `WHATSAPP_API_VERSION`     | No       | `v21.0` | Graph API version|

### Email (SMTP)

| Variable     | Required | Default | Description                |
|-------------|----------|---------|----------------------------|
| `SMTP_HOST` | No       | --      | SMTP server hostname       |
| `SMTP_PORT` | No       | `587`   | SMTP port                  |
| `SMTP_USER` | No       | --      | SMTP username              |
| `SMTP_PASS` | No       | --      | SMTP password / app password|
| `EMAIL_FROM`| No       | --      | From address for emails    |

### AI — Text Generation (OpenRouter)

| Variable            | Required | Description                      |
|--------------------|----------|----------------------------------|
| `OPENROUTER_API_KEY` | Yes     | OpenRouter API key (`sk-or-...`) |

### AI — Image Generation (Gemini)

| Variable         | Required | Description                   |
|-----------------|----------|-------------------------------|
| `GEMINI_API_KEY` | No       | Google Gemini API key         |

### Postiz (Social Media)

| Variable          | Required | Default                          | Description     |
|------------------|----------|----------------------------------|-----------------|
| `POSTIZ_API_KEY`  | No       | --                               | Postiz API key  |
| `POSTIZ_BASE_URL` | No       | `https://app.postiz.com/api/v1` | Postiz API base |

### Crawler

| Variable           | Required | Default               | Description              |
|-------------------|----------|-----------------------|--------------------------|
| `CRAWLER_BASE_URL` | No       | `http://crawler:3001` | Crawler microservice URL |

### Admin Dashboard

| Variable         | Required | Default | Description         |
|-----------------|----------|---------|---------------------|
| `ADMIN_USERNAME` | No       | `admin` | Bull Board login    |
| `ADMIN_PASSWORD` | Yes      | --      | Bull Board password |

### Brand Config

| Variable               | Required | Default   | Description                  |
|-----------------------|----------|-----------|------------------------------|
| `BRAND_NAME`          | No       | `SBEK`    | Brand display name           |
| `BRAND_PRIMARY_COLOR` | No       | `#B8860B` | Primary color (hex)          |
| `BRAND_WEBSITE`       | No       | --        | Store URL                    |
| `BRAND_SUPPORT_PHONE` | No       | --        | Support phone number         |
| `BRAND_SUPPORT_EMAIL` | No       | --        | Support email address        |
| `REVIEW_URL`          | No       | --        | Customer review landing page |

</details>

---

## Project Structure

```
sbek-automation/
|-- docker-compose.yml          # 4 services: app, crawler, redis, postgres
|-- Dockerfile                  # Multi-stage Node 20 Alpine build
|-- package.json                # Dependencies and npm scripts
|-- tsconfig.json               # TypeScript strict config (ES2022, bundler resolution)
|-- drizzle.config.ts           # Drizzle ORM migration config
|-- .env.example                # Template for environment variables
|
|-- src/
|   |-- index.ts                # Entrypoint: boot server, workers, cron, graceful shutdown
|   |-- app.ts                  # Express app factory
|   |
|   |-- config/                 # Environment, database, Redis, logger
|   |-- db/                     # Drizzle schema (5 tables)
|   |-- api/
|   |   |-- routes/             # Health, webhooks, jobs endpoints
|   |   |-- middleware/         # Auth, rate limiting, error handling, request logging
|   |
|   |-- queues/
|   |   |-- registry.ts        # 7 named queues with per-queue retry config
|   |   |-- definitions/       # Queue workers (one per queue)
|   |
|   |-- workflows/             # Business logic orchestration (8 workflows)
|   |-- services/              # External API wrappers (7 services)
|   |-- cron/                  # Scheduler + 4 job handlers
|   |-- templates/             # Email (.hbs) and WhatsApp templates
|   |-- utils/                 # Crypto, dates, retry, sanitization
|
|-- dashboard/                 # Next.js 15 admin dashboard (port 3002)
|-- crawler/                   # Standalone Playwright microservice (port 3001)
|-- creatives/                 # DALL-E prompt templates + size presets
|-- seo/                       # SEO/AEO prompt templates + JSON-LD schemas
|-- scripts/                   # Setup, webhook registration, testing
|-- test-data/                 # Sample WooCommerce payloads
|-- docs/                      # Architecture, runbook, workflow documentation
```

---

## How It Works

### Order Sync (WooCommerce -> Sheets)

When a new order is placed or updated on WooCommerce, a webhook fires to `POST /webhooks/woocommerce/order`. The server verifies the HMAC-SHA256 signature, enqueues a job on the `order-sync` queue, and returns `200` immediately. The worker parses the payload (extracting jewelry-specific metadata like ring size, metal type, stone type, and engraving text), writes or updates a row in the **Orders** tab of Google Sheets, and upserts the customer record in the **Customers** tab. A daily cron at 2 AM re-syncs orders from the last 3 days to catch any missed webhooks.

### Customer Communications (WhatsApp + Email)

Status changes trigger notifications through the `notification` queue. The system sends parallel WhatsApp template messages and Handlebars-rendered HTML emails at each stage:

- **Order confirmed** -- immediate on new order
- **Production started** -- when order enters production
- **QC passed** -- when quality check passes
- **Shipped** -- includes tracking number and carrier
- **Delivered** -- confirms receipt

The notification worker fans out to WhatsApp Cloud API and SMTP based on the `channel` field (`whatsapp`, `email`, or `both`).

### Production & QC Tracking

When an order enters production, the `production-tracking` workflow creates a row in the **Production** tab with all fabrication details (ring size, metal type, engraving, due date) and sends an internal WhatsApp brief to the assigned craftsperson. When production completes, the `qc-tracking` workflow creates checklist rows in the **QC** tab with 6 default inspection items (dimensions, finish, stone setting, engraving accuracy, polish, packaging). If all items pass, the order advances to dispatch-ready status. If any item fails, the order is sent back to production as a rework with the failed items noted.

### Review Collection (5-Day Delay)

When an order is marked as delivered, a review request job is enqueued on the `review-request` queue with a **5-day delay** (via BullMQ delayed jobs). After 5 days, the worker sends a WhatsApp + Email notification asking the customer to leave a review. A daily cron at 6 AM also scans the Orders sheet for delivered orders older than 5 days that have not yet received a review request, as a safety net.

### SEO/AEO Content Generation

A weekly cron on Monday at 9 AM enqueues `content-generation` jobs for all published products. The content pipeline generates:

- **SEO meta** (title + description) via AI, written back to WooCommerce as Yoast-compatible meta fields
- **FAQs** (5 Q&A pairs) formatted as FAQPage JSON-LD, stored in WooCommerce custom fields
- **AEO knowledge base** documents optimized for Answer Engine Optimization
- **Comparison articles** that position SBEK against market alternatives

### Ad Creative Generation (Gemini)

The `creative-generation` queue produces product images using Gemini in 5 variant styles:

| Variant        | Description                                      | Size      |
|---------------|--------------------------------------------------|-----------|
| `white_bg`    | Clean e-commerce product photo, white background | 1024x1024 |
| `lifestyle`   | Model wearing the piece at a luxury event        | 1024x1024 |
| `festive`     | Indian festive setting (Diwali, marigolds)       | 1024x1024 |
| `minimal_text`| Minimal layout with space for text overlay       | 1024x1024 |
| `story_format`| Vertical macro photography for Stories           | 1024x1792 |

Each generated image is logged to the **Creatives** tab in Google Sheets. An Instagram caption is also generated via AI.

### Social Media Scheduling (Postiz)

The `social-posting` worker uploads generated creative images to Postiz, creates draft posts with the AI-generated caption, and optionally schedules them for a future date. Posts can target Instagram, Facebook, or both platforms.

### Competitor Monitoring (Playwright Crawler)

A weekly cron on Sunday at 10 PM enqueues `competitor-crawl` jobs for each configured competitor. The crawler microservice (a separate Docker container running Playwright + Chromium) visits competitor websites, extracts product listings, blog posts, navigation structure, SEO signals, and generates a styled HTML report. The crawl data is then analyzed by AI for competitive insights. Significant changes (new collections, major price drops, aggressive promotions) trigger an internal WhatsApp alert.

---

## Development

```bash
# Start infrastructure (Redis + PostgreSQL)
docker compose up redis postgres -d

# Run the app in development mode (hot-reload via tsx)
npm run dev

# Type-check without emitting files
npm run typecheck

# Build for production
npm run build

# Run tests
npm test

# Open Drizzle Studio (database GUI)
npm run db:studio
```

---

## Scripts

| Script                          | Description                                                   |
|--------------------------------|---------------------------------------------------------------|
| `scripts/initial-setup.sh`     | One-command project setup (prereqs, install, build, Docker, migrations, Sheets) |
| `scripts/setup-sheets.ts`      | Create/configure Google Sheets with 8 tabs, headers, and default config |
| `scripts/register-webhooks.ts` | Register 4 WooCommerce webhooks pointing to your server       |
| `scripts/test-webhooks.sh`     | Send test requests to all endpoints and verify responses      |

```bash
# Setup Sheets
npm run setup:sheets

# Register webhooks
npm run setup:webhooks

# Test endpoints
./scripts/test-webhooks.sh [BASE_URL]
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/architecture.md](docs/architecture.md) | System design, dependency graph, database schema, queue configuration, error handling strategy |
| [docs/workflow.md](docs/workflow.md) | Visual breakdown of every automated workflow with ASCII diagrams |
| [docs/runbook.md](docs/runbook.md) | Day-to-day operations, manual triggers, monitoring, maintenance checklist |

---

## Troubleshooting

<details>
<summary><strong>Docker won't start / containers keep restarting</strong></summary>

```bash
docker compose logs app
docker compose logs postgres
docker compose logs redis
docker info
```

Common causes:
- `.env` file missing or has placeholder values
- Port 3000, 5432, or 6379 already in use
- Insufficient Docker memory (Playwright crawler needs 1GB+)

Reset if needed:
```bash
docker compose down -v
docker compose up -d
```
</details>

<details>
<summary><strong>Google Sheets API errors</strong></summary>

- **"The caller does not have permission"** -- Share the spreadsheet with the service account email (Editor access)
- **"Missing a valid API key"** -- Verify `GOOGLE_PRIVATE_KEY` has the full PEM key with `\n` for newlines
- **"GoogleSheetsService has not been initialised"** -- Check startup logs for the root cause
</details>

<details>
<summary><strong>WhatsApp template not approved</strong></summary>

- UTILITY templates are typically approved within minutes
- MARKETING templates may take longer and require business verification
- Template names in Meta's dashboard must exactly match the `templateName` in the code
- See `src/templates/whatsapp/templates.json` for required templates
</details>

<details>
<summary><strong>Webhook signature verification failing</strong></summary>

- Ensure `WOO_WEBHOOK_SECRET` in `.env` matches the secret used in WooCommerce
- The raw request body must be preserved for HMAC -- no middleware should parse/modify it before the webhook route
</details>

<details>
<summary><strong>OpenAI rate limits</strong></summary>

- Content generation and creative workers use low concurrency (2 and 1) to stay within limits
- Check your account for billing status and usage limits
- Gemini errors often mean the prompt was flagged by content policy
</details>

<details>
<summary><strong>Redis / PostgreSQL connection issues</strong></summary>

```bash
# Check Redis
docker compose exec redis redis-cli ping

# Check PostgreSQL
docker compose exec postgres pg_isready -U sbek

# If running outside Docker, update connection URLs in .env
```
</details>

<details>
<summary><strong>Database migrations</strong></summary>

```bash
npm run db:generate    # Generate migration files
npm run db:migrate     # Apply migrations
npm run db:studio      # Open Drizzle Studio GUI
```
</details>

---

## Tech Stack

| Category         | Technology                                                    |
|-----------------|---------------------------------------------------------------|
| **Runtime**      | Node.js 20, TypeScript (ES2022, strict mode)                 |
| **Server**       | Express.js, Helmet, CORS                                     |
| **Queues**       | BullMQ + Redis 7                                             |
| **Database**     | PostgreSQL 16 + Drizzle ORM                                  |
| **Scheduling**   | node-cron (4 scheduled jobs)                                 |
| **APIs**         | WooCommerce REST API v3, Google Sheets API, WhatsApp Cloud API, OpenRouter (text AI), Gemini (image AI), Postiz API |
| **Email**        | Nodemailer + Handlebars templates                            |
| **Crawler**      | Playwright + Chromium (separate microservice)                |
| **Validation**   | Zod (env vars), HMAC-SHA256 (webhooks)                       |
| **Logging**      | Pino (structured JSON)                                       |
| **Dashboard**    | Next.js 15, React 18, SWR, Tailwind CSS                      |
| **Containers**   | Docker Compose (5 services)                                  |
