# Architecture

Technical architecture document for the SBEK Automation system.

---

## Design Philosophy

The system follows three strict rules that keep the codebase predictable and debuggable:

### 1. Services never call services

A service (e.g., `openai.service.ts`, `whatsapp.service.ts`) is a thin, stateless wrapper around a single external API. Services never import or call other services. All orchestration happens in **workflow** functions that compose multiple service calls into a business process. This means you can read any service file in isolation and understand exactly what it does without tracing cross-service dependencies.

```
WRONG:   email.service.ts imports whatsapp.service.ts
CORRECT: notification.queue.ts worker calls both email.service and whatsapp.service
```

### 2. Cron jobs only enqueue

Cron job handlers (`src/cron/jobs/`) never perform business logic directly. They query for work (e.g., "which delivered orders need review requests?"), then enqueue BullMQ jobs for each item. This ensures that:

- Cron execution is fast (seconds, not minutes)
- Individual items get independent retries via BullMQ
- The queue dashboard shows exactly what is pending/failed
- No data is lost if the process restarts mid-cron

```
WRONG:   daily-review-requests.ts sends WhatsApp messages directly
CORRECT: daily-review-requests.ts adds jobs to the review-request queue
```

### 3. Webhooks are thin

Webhook handlers (`src/api/routes/webhooks.routes.ts`) do three things and nothing more:

1. Verify the HMAC signature
2. Enqueue a job with the raw payload
3. Return `200 OK` immediately

All processing happens asynchronously in queue workers. This guarantees fast webhook response times (WooCommerce expects responses within 5 seconds) and prevents data loss if processing fails.

---

## Module Dependency Graph

```
index.ts
  |-- app.ts
  |     |-- api/routes/index.ts
  |     |     |-- health.routes.ts      -> config/redis, config/database
  |     |     |-- webhooks.routes.ts    -> queues/registry, middleware/webhookAuth
  |     |     |-- jobs.routes.ts        -> queues/registry
  |     |-- middleware/
  |           |-- webhookAuth.ts        -> config/env
  |           |-- rateLimiter.ts        (standalone)
  |           |-- errorHandler.ts       -> config/logger
  |           |-- requestLogger.ts      -> config/logger
  |
  |-- config/
  |     |-- env.ts                      (standalone, Zod schema)
  |     |-- database.ts                 -> config/env, db/schema
  |     |-- redis.ts                    -> config/env
  |     |-- logger.ts                   -> config/env
  |
  |-- queues/
  |     |-- types.ts                    (standalone, interfaces only)
  |     |-- connection.ts               -> config/env
  |     |-- registry.ts                 -> config/env, queues/types
  |     |-- definitions/
  |           |-- order-sync.queue.ts         -> workflows/order-processing
  |           |-- notification.queue.ts       -> services/whatsapp, services/email
  |           |-- review-request.queue.ts     -> workflows/review-collection
  |           |-- content-generation.queue.ts -> workflows/content-pipeline
  |           |-- creative-generation.queue.ts -> workflows/creative-pipeline
  |           |-- social-posting.queue.ts     -> services/postiz
  |           |-- competitor-crawl.queue.ts   -> workflows/competitor-monitoring
  |
  |-- workflows/
  |     |-- order-processing.workflow.ts      -> services/woocommerce, services/googlesheets, queues/registry
  |     |-- customer-comms.workflow.ts        -> queues/registry
  |     |-- production-tracking.workflow.ts   -> services/googlesheets, queues/registry
  |     |-- qc-tracking.workflow.ts           -> services/googlesheets, queues/registry
  |     |-- review-collection.workflow.ts     -> queues/registry, config/env
  |     |-- content-pipeline.workflow.ts      -> services/openai, services/woocommerce, services/googlesheets
  |     |-- creative-pipeline.workflow.ts     -> services/openai, services/googlesheets
  |     |-- competitor-monitoring.workflow.ts -> services/crawler, services/openai, services/googlesheets, queues/registry
  |
  |-- services/                         (each service depends ONLY on config/env and config/logger)
  |     |-- woocommerce.service.ts
  |     |-- googlesheets.service.ts     + utils/sanitize
  |     |-- whatsapp.service.ts
  |     |-- email.service.ts
  |     |-- openai.service.ts
  |     |-- postiz.service.ts
  |     |-- crawler.service.ts
  |
  |-- cron/
  |     |-- scheduler.ts                -> cron/jobs/*
  |     |-- jobs/
  |           |-- daily-sheets-sync.ts         -> services/woocommerce, queues/registry
  |           |-- daily-review-requests.ts     -> services/googlesheets, queues/registry
  |           |-- weekly-content-generation.ts -> services/woocommerce, queues/registry
  |           |-- weekly-competitor-crawl.ts   -> queues/registry
  |
  |-- utils/                            (standalone utilities, no service or workflow imports)
        |-- crypto.ts
        |-- date.ts
        |-- retry.ts
        |-- sanitize.ts
```

Key observation: **dependencies always flow downward**. Workflows depend on services, but services never depend on workflows. Queue workers depend on workflows, but workflows never depend on queue definitions. This keeps circular dependencies impossible.

---

## Database Schema

The PostgreSQL database (managed by Drizzle ORM) has 5 tables. The database is an audit log and configuration store -- Google Sheets is the primary operational data store.

### `job_logs`

Tracks every BullMQ job through its lifecycle.

| Column        | Type         | Description                                      |
|--------------|-------------|--------------------------------------------------|
| `id`          | serial (PK) | Auto-incrementing primary key                    |
| `queue_name`  | varchar(100)| Which queue the job belongs to                   |
| `job_id`      | varchar(100)| BullMQ job ID                                    |
| `status`      | text        | `queued`, `active`, `completed`, `failed`, `retrying` |
| `payload`     | jsonb       | Job input data                                   |
| `result`      | jsonb       | Job output data (on completion)                  |
| `error`       | text        | Error message (on failure)                       |
| `attempts`    | integer     | Number of attempts so far                        |
| `created_at`  | timestamp   | When the job was enqueued                        |
| `completed_at`| timestamp   | When the job finished                            |

### `webhook_events`

Stores every inbound webhook payload for audit and replay.

| Column        | Type         | Description                                |
|--------------|-------------|---------------------------------------------|
| `id`          | serial (PK) | Auto-incrementing primary key              |
| `source`      | varchar(50) | e.g., `woocommerce`                        |
| `event`       | varchar(100)| e.g., `order.created`                      |
| `payload`     | jsonb       | Full webhook payload                       |
| `processed`   | boolean     | Whether the payload has been processed     |
| `processed_at`| timestamp   | When processing completed                  |
| `created_at`  | timestamp   | When the webhook was received              |

### `cron_runs`

Audit log for every scheduled cron execution.

| Column           | Type         | Description                          |
|-----------------|-------------|--------------------------------------|
| `id`             | serial (PK) | Auto-incrementing primary key       |
| `job_name`       | varchar(100)| Cron job identifier                  |
| `started_at`     | timestamp   | Execution start time                 |
| `completed_at`   | timestamp   | Execution end time                   |
| `items_processed`| integer     | Number of items processed            |
| `error`          | text        | Error message (if failed)            |

### `competitor_snapshots`

Point-in-time competitor website data from the crawler.

| Column           | Type         | Description                              |
|-----------------|-------------|------------------------------------------|
| `id`             | serial (PK) | Auto-incrementing primary key           |
| `competitor_name`| varchar(200)| Human-readable competitor name           |
| `url`            | varchar(500)| Crawled URL                              |
| `data`           | jsonb       | Full crawl result (products, SEO, etc.)  |
| `crawled_at`     | timestamp   | When the crawl was performed             |

### `system_config`

Key-value store for runtime configuration.

| Column      | Type         | Description                             |
|------------|-------------|------------------------------------------|
| `id`        | serial (PK) | Auto-incrementing primary key           |
| `key`       | varchar(100)| Unique config key                        |
| `value`     | jsonb       | Config value (any JSON type)             |
| `updated_at`| timestamp   | Last modification time                   |

---

## Queue Configuration

All 7 queues use Redis-backed BullMQ with automatic cleanup: completed jobs are removed after 7 days, failed jobs after 30 days.

| Queue                | Concurrency | Max Attempts | Backoff Type  | Initial Delay | Rate Limit        | Notes                            |
|---------------------|-------------|-------------|---------------|--------------|-------------------|----------------------------------|
| `order-sync`        | 3           | 5           | Exponential    | 1s           | 10 jobs/min       | Respects WooCommerce API limits  |
| `notification`      | 5           | 5           | Exponential    | 2s           | 20 jobs/min       | Fan-out: WhatsApp + Email        |
| `review-request`    | 2           | 3           | Exponential    | 5s           | --                | Jobs created with 5-day delay    |
| `content-generation`| 2           | 3           | Exponential    | 10s          | --                | Low concurrency for OpenAI limits|
| `creative-generation`| 1          | 3           | Exponential    | 15s          | --                | DALL-E 3 is slow and expensive   |
| `social-posting`    | 1           | 4           | Exponential    | 5s           | --                | Sequential Postiz uploads        |
| `competitor-crawl`  | 1           | 3           | Exponential    | 30s          | --                | 60s lock duration; crawling is slow |

### Retry behavior

All queues use **exponential backoff**. For example, the `notification` queue with `delay: 2000`:

- Attempt 1: immediate
- Attempt 2: 2s delay
- Attempt 3: 4s delay
- Attempt 4: 8s delay
- Attempt 5: 16s delay

After the final attempt, the job moves to the `failed` state and remains in Redis for 30 days (available for manual inspection and retry via Bull Board or the jobs API).

---

## Google Sheets Tab Structure

The Google Spreadsheet serves as the primary operational dashboard. The `setup-sheets.ts` script creates all tabs with frozen header rows.

### Orders (17 columns)

The central order tracker. Updated by the `order-sync` worker and read by production, QC, and review workflows.

```
Order ID | Customer Name | Phone | Email | Product | Variant | Size | Metal |
Stones | Engraving | Amount | Order Date | Promised Delivery | Status |
Production Assignee | Notes | Last Updated
```

**Status values:** `New`, `In Production`, `QC`, `Shipped`, `Delivered`, `Cancelled`, `Refunded`, `Failed`

### Production (14 columns)

One row per production task. Created when an order enters production, updated through completion.

```
Order ID | Product | Customer | Ring Size | Metal Type | Stones | Engraving Text |
Reference Image URL | Assigned To | Due Date | Started Date | Completed Date |
Status | Notes
```

**Status values:** `In Progress`, `Completed`, `Rework`

### QC (9 columns)

One row per checklist item per order. The default checklist has 6 items, so each order typically gets 6 QC rows.

```
Order ID | Product | QC Date | Checklist Item | Pass/Fail | Photo URL |
Inspector | Notes | Action Taken
```

**Default checklist items:**
1. Dimensions match order specs
2. Metal finish quality
3. Stone setting secure
4. Engraving accuracy
5. Surface polish
6. Packaging condition

### Customers (9 columns)

Customer CRM. Upserted (keyed on Email) every time an order is processed.

```
Customer ID | Name | Email | Phone | Total Orders | Total Spend |
Last Order Date | Tags | Notes
```

### Creatives (10 columns)

Tracks AI-generated ad creatives through their lifecycle from generation to posting.

```
Product ID | Product Name | Variant | Creative Type | Image URL | Drive Link |
Generated Date | Status | Approved By | Posted Date
```

**Status values:** `Generated`, `Approved`, `Posted`, `Rejected`

### System Logs (5 columns)

Operational event log. Written by workflows as fire-and-forget entries. Errors in writing to this tab are silently swallowed to avoid blocking the caller.

```
Timestamp | Level | Source | Message | Details
```

### Config (4 columns)

Runtime configuration key-value pairs. Created by the setup script with defaults.

```
Key | Value | Description | Updated
```

**Default config keys:**
- `default_production_days`: `14`
- `qc_buffer_days`: `2`
- `review_delay_days`: `5`
- `openai_image_credits`: `1000`

### Competitors (5 columns)

Competitor list for the weekly crawl job.

```
Name | URL | Category | Last Crawled | Notes
```

---

## Error Handling Strategy

### Layer 1: Input Validation (Zod)

Environment variables are validated at boot time using a Zod schema (`src/config/env.ts`). In production, missing required variables cause the process to crash immediately with a clear error message. In development, the app logs warnings and boots with partial config to enable local iteration.

### Layer 2: Webhook Signature Verification

Every inbound WooCommerce webhook is verified using HMAC-SHA256 with timing-safe comparison (`src/api/middleware/webhookAuth.ts`). Invalid signatures return `401`. This prevents forged webhook payloads.

### Layer 3: Rate Limiting

Three tiers of rate limiting protect the API:

| Limiter    | Window   | Max Requests | Applied To            |
|-----------|----------|-------------|------------------------|
| API       | 15 min   | 100/IP      | `/jobs/*` routes       |
| Webhook   | 1 min    | 300/IP      | `/webhooks/*` routes   |
| Crawler   | 1 min    | 10/IP       | Crawler endpoints      |

### Layer 4: BullMQ Automatic Retries

Every queue has a configured number of retries with exponential backoff. Failed jobs are preserved in Redis for 30 days for manual inspection. The queue worker emits `completed` and `failed` events that are logged via Pino.

### Layer 5: Exponential Backoff Utility

For non-queue API calls (e.g., during cron job execution), the `withRetry` utility (`src/utils/retry.ts`) provides configurable retry with exponential backoff, max delay cap, and per-retry callbacks.

### Layer 6: Spreadsheet Formula Injection Prevention

All data written to Google Sheets passes through `sanitizeForSheets()` (`src/utils/sanitize.ts`), which prefixes dangerous characters (`=`, `+`, `-`, `@`, tab, carriage return) with an apostrophe to prevent spreadsheet formula injection attacks.

### Layer 7: Global Express Error Handler

Unhandled errors in route handlers are caught by the global error handler (`src/api/middleware/errorHandler.ts`). It distinguishes between client errors (4xx, logged at `warn` level) and server errors (5xx, logged at `error` level). Stack traces are included in responses only in development mode.

### Layer 8: Process-Level Safety

The main process (`src/index.ts`) handles:
- `SIGTERM` / `SIGINT`: Graceful shutdown -- closes HTTP server, drains all queues, disconnects Redis and PostgreSQL
- `unhandledRejection`: Logs the error, process continues
- `uncaughtException`: Logs the error as fatal, process exits immediately

---

## Data Flow: Key Scenarios

### Scenario 1: New Order

```
1. Customer places order on WooCommerce
2. WooCommerce fires POST /webhooks/woocommerce/order
   Headers: x-wc-webhook-topic: order.created, x-wc-webhook-signature: <hmac>
3. webhooks.routes.ts:
   a. webhookAuth middleware verifies HMAC-SHA256 signature
   b. Enqueues job on order-sync queue: { orderId, event: "order.created", rawPayload }
   c. Returns 200 { received: true, orderId, event }
4. order-sync worker picks up job:
   a. Calls woocommerce.parseOrderForSheets(rawPayload)
      - Extracts customer name, phone, email, products, variant details
      - Extracts jewelry metadata: ring size, metal type, stone type, engraving
   b. Calls sheets.findOrderRow(orderId) -> null (new order)
   c. Calls sheets.appendOrder({...}) -> new row in Orders tab
   d. Calculates promised delivery date (order date + 14 days)
   e. Enqueues notification job: { channel: "both", templateName: "order_confirmation" }
   f. Calls sheets.upsertCustomer({...}) -> creates/updates Customers tab
5. notification worker picks up job:
   a. Sends WhatsApp template message via Cloud API
   b. Sends HTML email via SMTP (rendered from order-confirmation.hbs)
```

### Scenario 2: Status Change (Order Shipped)

```
1. Admin updates order status to "Shipped" in WooCommerce
2. WooCommerce fires POST /webhooks/woocommerce/order
   Headers: x-wc-webhook-topic: order.updated
3. Server verifies signature, enqueues order-sync job
4. order-sync worker:
   a. Parses payload, finds existing row in Orders tab
   b. Updates status to "Shipped", sets Last Updated
5. customer-comms workflow (triggered by status change):
   a. Enqueues notification: { templateName: "shipped", templateData: { tracking_number, carrier_name } }
6. notification worker:
   a. Sends "Your SBEK order is on its way!" via WhatsApp + Email
```

### Scenario 3: Content Generation (Weekly SEO Batch)

```
1. Monday 9:00 AM IST: weekly-content-generation cron fires
2. Fetches all published products from WooCommerce API
3. For each product, enqueues 2 jobs on content-generation queue:
   - { productId, productName, type: "seo_meta" }
   - { productId, productName, type: "faq" }
4. content-generation worker (concurrency: 2) processes jobs:

   For seo_meta:
   a. Fetches full product details from WooCommerce (categories, attributes)
   b. Sends GPT-4o prompt with product info, brand guidelines, SEO rules
   c. Parses JSON response: { title (max 60 chars), description (max 160 chars) }
   d. Updates WooCommerce product with Yoast meta fields
   e. Logs to System Logs tab in Sheets

   For faq:
   a. Fetches product details
   b. Sends GPT-4o prompt requesting 5 FAQ pairs
   c. Formats as FAQPage JSON-LD schema
   d. Stores JSON-LD in WooCommerce custom field (_sbek_faq_json_ld)
   e. Logs to System Logs tab
```

### Scenario 4: Competitor Monitoring

```
1. Sunday 10:00 PM IST: weekly-competitor-crawl cron fires
2. For each competitor in DEFAULT_COMPETITORS list:
   a. Enqueues job on competitor-crawl queue: { competitorName, url }
3. competitor-crawl worker (concurrency: 1):
   a. Calls crawler.analyzeSite(url) -> HTTP POST to crawler microservice
4. Crawler microservice:
   a. Checks robots.txt for crawl permission
   b. Launches headless Chromium via Playwright
   c. Navigates to homepage, extracts:
      - Page title, meta description, H1 tags, OG tags
      - Product listings (name, price, URL) using 3 strategies:
        i.  CSS selector matching (product cards)
        ii. Link pattern matching (/products/, /shop/)
        iii. JSON-LD structured data parsing
      - Blog posts (title, URL, date)
      - Navigation links
      - SEO health score
   d. If no products on homepage, follows first product listing link
   e. Analyzes changes against previous crawl (if provided):
      - New/removed products
      - Price changes > 10%
      - New blog posts
      - Content freshness score (0-100)
   f. Generates styled HTML report -> saved to /app/reports/
   g. Returns full analysis to main app
5. Back in competitor-monitoring workflow:
   a. Sends crawl data to GPT-4o for competitive analysis
   b. Logs analysis to System Logs tab
   c. Checks for significant changes (new collections, price drops, etc.)
   d. If significant: sends internal WhatsApp alert to admin
```

---

## Infrastructure

### Docker Services

| Service    | Image                          | Port | Health Check         | Restart Policy |
|-----------|-------------------------------|------|----------------------|---------------|
| `app`      | Custom (Node 20 Alpine)       | 3000 | Depends on redis + pg | unless-stopped |
| `crawler`  | Custom (Playwright Noble)     | 3001 | --                   | unless-stopped |
| `redis`    | redis:7-alpine                | 6379 | `redis-cli ping`     | unless-stopped |
| `postgres` | postgres:16-alpine            | 5432 | `pg_isready`         | unless-stopped |

### Docker Volumes

| Volume      | Purpose                                |
|------------|----------------------------------------|
| `redis_data`| Redis persistence (RDB snapshots)     |
| `pg_data`   | PostgreSQL data directory             |
| `./reports` | Bind mount for crawler HTML reports   |

### Network

All services share the `sbek-net` bridge network. Internal DNS resolves service names (e.g., `redis:6379`, `postgres:5432`, `crawler:3001`).
