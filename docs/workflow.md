# Workflow Guide

Visual breakdown of every automated workflow in the SBEK system. Each section shows the trigger, the step-by-step flow, what services are involved, and what data ends up where.

---

## Table of Contents

1. [Order Lifecycle (End-to-End)](#1-order-lifecycle-end-to-end)
2. [Order Sync](#2-order-sync)
3. [Customer Notifications](#3-customer-notifications)
4. [Production Tracking](#4-production-tracking)
5. [Quality Control (QC)](#5-quality-control-qc)
6. [Review Collection](#6-review-collection)
7. [SEO/AEO Content Generation](#7-seoaeo-content-generation)
8. [Ad Creative Generation](#8-ad-creative-generation)
9. [Social Media Posting](#9-social-media-posting)
10. [Competitor Monitoring](#10-competitor-monitoring)
11. [Scheduled Jobs (Cron)](#11-scheduled-jobs-cron)
12. [Complete System Map](#12-complete-system-map)

---

## 1. Order Lifecycle (End-to-End)

The full journey of an order from placement to review collection:

```
Customer places order on WooCommerce
        │
        ▼
┌──────────────────┐
│  1. ORDER SYNC   │  Webhook → parse → write to Google Sheets
│     Status: New  │  Send: Order Confirmation (WhatsApp + Email)
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│  2. PRODUCTION       │  Admin assigns order → production task created
│     Status: In Prod  │  Send: "Crafting started" to customer
│                      │  Send: Internal brief to craftsperson
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│  3. QUALITY CONTROL  │  6-point checklist evaluated
│     Status: QC       │
└────────┬─────────────┘
         │
    ┌────┴────┐
    │         │
  PASS      FAIL
    │         │
    ▼         ▼
┌────────┐  ┌─────────────┐
│ QC OK  │  │  REWORK     │  Back to Production
│        │  │  Status:    │  Alert sent to team
│ Send:  │  │  In Prod    │
│ "QC    │  └──────┬──────┘
│ passed"│         │
│ email  │         ▼
└───┬────┘    (repeat from
    │          step 2)
    ▼
┌──────────────────────┐
│  4. SHIPPED          │  Admin updates tracking info
│     Status: Shipped  │  Send: Tracking details (WhatsApp + Email)
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│  5. DELIVERED        │  Status updated from WooCommerce
│     Status: Delivered│  Send: Delivery confirmation
└────────┬─────────────┘
         │
         │  (5-day delay via BullMQ delayed job)
         │
         ▼
┌──────────────────────┐
│  6. REVIEW REQUEST   │  Send: "How was your order?" (WhatsApp + Email)
│                      │  Links to review page
└──────────────────────┘
```

---

## 2. Order Sync

**Trigger:** WooCommerce webhook (`order.created` or `order.updated`)
**Files:** `webhooks.routes.ts` → `order-sync.queue.ts` → `order-processing.workflow.ts`

```
WooCommerce Store
       │
       │  POST /webhooks/woocommerce/order
       │  Headers: x-wc-webhook-signature (HMAC-SHA256)
       ▼
┌─────────────────────────────────┐
│  Express Webhook Handler        │
│                                 │
│  1. Verify HMAC signature       │
│  2. Log raw payload to DB       │
│  3. Enqueue job on order-sync   │
│  4. Return 200 OK immediately   │
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│  order-sync Queue Worker        │
│  (concurrency: 3, retries: 5)  │
│                                 │
│  1. Parse WooCommerce payload   │
│     ├─ Customer: name, phone,   │
│     │   email                   │
│     ├─ Products: name, variant  │
│     ├─ Jewelry Meta:            │
│     │   ring size, metal type,  │
│     │   stone type, engraving   │
│     └─ Payment: amount, method  │
│                                 │
│  2. Check Google Sheets         │
│     ├─ New? → append row        │
│     └─ Exists? → update row     │
│                                 │
│  3. Calculate promised delivery │
│     (order date + 14 days)      │
│                                 │
│  4. Enqueue notification        │
│     (order_confirmation)        │
│                                 │
│  5. Upsert customer record      │
└─────────────────────────────────┘
            │
            ▼
   Google Sheets Updated
   ├─ Orders tab (17 columns)
   └─ Customers tab (9 columns)
```

**Status mapping (WooCommerce → Sheets):**

| WooCommerce Status | Sheets Status |
|-------------------|---------------|
| `pending`         | New           |
| `processing`      | New           |
| `on-hold`         | New           |
| `completed`       | Delivered     |
| `cancelled`       | Cancelled     |
| `refunded`        | Refunded      |
| `failed`          | Failed        |

---

## 3. Customer Notifications

**Trigger:** Order status change
**Files:** `customer-comms.workflow.ts` → `notification.queue.ts`

```
Status Change Detected
       │
       ▼
┌─────────────────────────────────────┐
│  customer-comms workflow            │
│                                     │
│  Maps status → notification:        │
│                                     │
│  "In Production"                    │
│   └─ Template: production_started   │
│   └─ Channel: WhatsApp + Email      │
│                                     │
│  "Shipped"                          │
│   └─ Template: shipped              │
│   └─ Data: tracking #, carrier      │
│   └─ Channel: WhatsApp + Email      │
│                                     │
│  "Delivered"                        │
│   └─ Template: delivered            │
│   └─ Channel: WhatsApp + Email      │
│   └─ Schedule review (5-day delay)  │
└───────────┬─────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│  notification Queue Worker          │
│  (concurrency: 5, retries: 5)      │
│                                     │
│  Fan-out based on channel field:    │
│                                     │
│  channel: "whatsapp"                │
│   └─ WhatsApp Cloud API            │
│      └─ Send template message       │
│                                     │
│  channel: "email"                   │
│   └─ Nodemailer + SMTP             │
│      └─ Render Handlebars .hbs      │
│      └─ Inline CSS, SBEK branding   │
│                                     │
│  channel: "both"                    │
│   └─ WhatsApp + Email in parallel   │
└─────────────────────────────────────┘
```

**Notification templates available:**

| Template              | Type     | Trigger          | Channel |
|----------------------|----------|------------------|---------|
| `order_confirmation` | Customer | New order        | Both    |
| `production_started` | Customer | Enter production | Both    |
| `qc_passed`          | Customer | QC passes        | Both    |
| `shipped`            | Customer | Order shipped    | Both    |
| `delivered`          | Customer | Order delivered  | Both    |
| `review_request`     | Customer | 5 days post-delivery | Both |
| `production_brief`   | Internal | Order assigned   | WhatsApp |
| `qc_failed_alert`    | Internal | QC failure       | WhatsApp |

---

## 4. Production Tracking

**Trigger:** Admin moves order to "In Production"
**Files:** `production-tracking.workflow.ts`

```
Admin Assigns Order to Craftsperson
       │
       ▼
┌─────────────────────────────────────┐
│  createProductionTask()             │
│                                     │
│  1. Fetch order from Sheets         │
│     └─ Orders tab → find by ID     │
│                                     │
│  2. Create production row           │
│     ├─ Order ID                     │
│     ├─ Product name                 │
│     ├─ Ring Size, Metal, Stones     │
│     ├─ Engraving Text              │
│     ├─ Assigned To (craftsperson)   │
│     ├─ Due Date (delivery - 2 days) │
│     ├─ Started Date (now)           │
│     └─ Status: In Progress         │
│                                     │
│  3. Update Orders tab               │
│     └─ Status → "In Production"    │
│     └─ Production Assignee set     │
│                                     │
│  4. Send internal WhatsApp brief    │
│     └─ To: assigned craftsperson   │
│     └─ Details: specs, due date    │
│                                     │
│  5. Send customer notification      │
│     └─ "Your piece is being        │
│        handcrafted"                │
└─────────────────────────────────────┘
            │
            ▼
   Google Sheets Updated
   ├─ Production tab (new row)
   └─ Orders tab (status updated)

            │
   (craftsperson works on the piece)
            │
            ▼
┌─────────────────────────────────────┐
│  completeProduction()               │
│                                     │
│  1. Update Production tab           │
│     └─ Status → "Completed"        │
│     └─ Completed Date set          │
│                                     │
│  2. Update Orders tab               │
│     └─ Status → "QC"               │
│                                     │
│  → Triggers QC Workflow             │
└─────────────────────────────────────┘
```

---

## 5. Quality Control (QC)

**Trigger:** Production completes (order moves to "QC" status)
**Files:** `qc-tracking.workflow.ts`

```
Production Completed
       │
       ▼
┌──────────────────────────────────────┐
│  createQCChecklist()                 │
│                                      │
│  Creates 6 rows in QC tab:           │
│                                      │
│  ┌──────────────────────────┬──────┐ │
│  │ Checklist Item           │Status│ │
│  ├──────────────────────────┼──────┤ │
│  │ Dimensions match specs   │ ?    │ │
│  │ Metal finish quality     │ ?    │ │
│  │ Stone setting secure     │ ?    │ │
│  │ Engraving accuracy       │ ?    │ │
│  │ Surface polish           │ ?    │ │
│  │ Packaging condition      │ ?    │ │
│  └──────────────────────────┴──────┘ │
│                                      │
│  Inspector fills in Pass/Fail        │
│  for each item in Google Sheets      │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  evaluateQCResults()                 │
│                                      │
│  Read all 6 items for this order     │
│                                      │
│  ┌─────────────┐   ┌──────────────┐ │
│  │ ALL PASSED  │   │ ANY FAILED   │ │
│  │             │   │              │ │
│  │ Update      │   │ Status →     │ │
│  │ status to   │   │ "In Prod"    │ │
│  │ "QC Passed" │   │ (rework)     │ │
│  │             │   │              │ │
│  │ Notify      │   │ Reset prod   │ │
│  │ customer:   │   │ task with    │ │
│  │ "QC passed" │   │ failed items │ │
│  │             │   │              │ │
│  │ Ready for   │   │ Alert prod   │ │
│  │ dispatch    │   │ team via     │ │
│  │             │   │ WhatsApp     │ │
│  └─────────────┘   └──────────────┘ │
└──────────────────────────────────────┘
```

---

## 6. Review Collection

**Trigger:** Order delivered + 5 day delay
**Files:** `customer-comms.workflow.ts` → `review-request.queue.ts` → `review-collection.workflow.ts`

```
Order Delivered
       │
       ├─── Immediate: send delivery confirmation
       │
       └─── Delayed (5 days): enqueue review request
                │
                │  BullMQ delayed job
                │  delay: 5 × 24 × 60 × 60 × 1000 ms
                │
                ▼  (after 5 days)
┌──────────────────────────────────────┐
│  review-request Queue Worker         │
│                                      │
│  1. Send review request notification │
│     ├─ WhatsApp: template message    │
│     │   with review link             │
│     └─ Email: branded HTML with      │
│        "Rate your experience" CTA    │
│                                      │
│  2. Log to System Logs tab           │
└──────────────────────────────────────┘

Safety Net (Cron):
┌──────────────────────────────────────┐
│  Daily at 6:00 AM                    │
│                                      │
│  Scan Orders tab for:                │
│  - Status = "Delivered"              │
│  - Delivered > 5 days ago            │
│  - No review request sent yet        │
│                                      │
│  Enqueue missed review requests      │
└──────────────────────────────────────┘
```

---

## 7. SEO/AEO Content Generation

**Trigger:** Weekly cron (Monday 9:00 AM) or manual
**Files:** `weekly-content-generation.ts` → `content-generation.queue.ts` → `content-pipeline.workflow.ts`

```
Monday 9:00 AM (Cron)
       │
       ▼
┌──────────────────────────────────────┐
│  weekly-content-generation job       │
│                                      │
│  1. Fetch all published products     │
│     from WooCommerce API             │
│                                      │
│  2. For each product, enqueue:       │
│     ├─ { type: "seo_meta" }         │
│     └─ { type: "faq" }              │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  content-generation Queue Worker     │
│  (concurrency: 2, retries: 3)       │
│                                      │
│  Routes by type:                     │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ seo_meta                      │  │
│  │                               │  │
│  │ 1. Fetch product details      │  │
│  │    (categories, attributes)   │  │
│  │                               │  │
│  │ 2. GPT-4o generates:          │  │
│  │    ├─ Title (max 60 chars)    │  │
│  │    └─ Description (160 chars) │  │
│  │                               │  │
│  │ 3. Update WooCommerce:        │  │
│  │    ├─ _yoast_wpseo_title      │  │
│  │    └─ _yoast_wpseo_metadesc   │  │
│  │                               │  │
│  │ 4. Log to Sheets              │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ faq                           │  │
│  │                               │  │
│  │ 1. Fetch product details      │  │
│  │                               │  │
│  │ 2. GPT-4o generates:          │  │
│  │    └─ 5 Q&A pairs             │  │
│  │                               │  │
│  │ 3. Format as FAQPage JSON-LD  │  │
│  │                               │  │
│  │ 4. Update WooCommerce:        │  │
│  │    ├─ _sbek_faq_json_ld       │  │
│  │    └─ _sbek_faqs              │  │
│  │                               │  │
│  │ 5. Log to Sheets              │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ aeo_kb                        │  │
│  │                               │  │
│  │ GPT-4o generates brand        │  │
│  │ knowledge-base article        │  │
│  │ optimized for AI assistants   │  │
│  │ and featured snippets         │  │
│  │                               │  │
│  │ Sections: brand overview,     │  │
│  │ collections, craftsmanship,   │  │
│  │ customization, pricing,       │  │
│  │ customer experience           │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ comparison                    │  │
│  │                               │  │
│  │ GPT-4o generates comparison   │  │
│  │ article (800-1200 words)      │  │
│  │ positioning SBEK vs market    │  │
│  │ alternatives with comparison  │  │
│  │ table in markdown             │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## 8. Ad Creative Generation

**Trigger:** Manual or batch job
**Files:** `creative-generation.queue.ts` → `creative-pipeline.workflow.ts`

```
Product Queued for Creative Generation
       │
       ▼
┌──────────────────────────────────────┐
│  creative-generation Queue Worker    │
│  (concurrency: 1, retries: 3)       │
│                                      │
│  For each product, generate 5        │
│  DALL-E 3 image variants:            │
│                                      │
│  ┌────────┬──────────────────────┐   │
│  │Variant │ Description          │   │
│  ├────────┼──────────────────────┤   │
│  │white_bg│ Clean product shot   │   │
│  │        │ on white background  │   │
│  │        │ (1024×1024)          │   │
│  ├────────┼──────────────────────┤   │
│  │life-   │ Model wearing the    │   │
│  │style   │ piece at a luxury    │   │
│  │        │ event (1024×1024)    │   │
│  ├────────┼──────────────────────┤   │
│  │festive │ Indian festive       │   │
│  │        │ setting: Diwali,     │   │
│  │        │ marigolds (1024×1024)│   │
│  ├────────┼──────────────────────┤   │
│  │minimal │ Minimal layout with  │   │
│  │_text   │ space for text       │   │
│  │        │ overlay (1024×1024)  │   │
│  ├────────┼──────────────────────┤   │
│  │story_  │ Vertical macro       │   │
│  │format  │ photography for      │   │
│  │        │ Stories (1024×1792)  │   │
│  └────────┴──────────────────────┘   │
│                                      │
│  For each variant:                   │
│  1. Load prompt template from        │
│     creatives/prompts/{variant}.txt  │
│  2. Inject product name + details    │
│  3. Call DALL-E 3 API                │
│  4. Log to Creatives tab in Sheets   │
│     (status: "Generated")           │
│                                      │
│  Also generates:                     │
│  └─ Instagram caption via GPT-4o    │
└──────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  Google Sheets: Creatives Tab        │
│                                      │
│  Product ID | Product Name | Variant │
│  Creative Type | Image URL          │
│  Drive Link | Generated Date        │
│  Status | Approved By | Posted Date │
│                                      │
│  Status lifecycle:                   │
│  Generated → Approved → Posted      │
│           └→ Rejected               │
└──────────────────────────────────────┘
```

---

## 9. Social Media Posting

**Trigger:** Approved creative ready for posting
**Files:** `social-posting.queue.ts` → `postiz.service.ts`

```
Creative Approved in Sheets
(Status changed to "Approved")
       │
       ▼
┌──────────────────────────────────────┐
│  social-posting Queue Worker         │
│  (concurrency: 1, retries: 4)       │
│                                      │
│  1. Upload image to Postiz           │
│     └─ POST /media/upload            │
│                                      │
│  2. Create post                      │
│     ├─ Caption: AI-generated         │
│     ├─ Media: uploaded image ID      │
│     ├─ Platforms: Instagram, FB      │
│     └─ Schedule: specified date/time │
│                                      │
│  3. Update Creatives tab             │
│     └─ Status → "Posted"            │
│     └─ Posted Date set              │
└──────────────────────────────────────┘
            │
            ▼
    Post appears on Instagram/Facebook
    at the scheduled time via Postiz
```

---

## 10. Competitor Monitoring

**Trigger:** Weekly cron (Sunday 10:00 PM)
**Files:** `weekly-competitor-crawl.ts` → `competitor-crawl.queue.ts` → `competitor-monitoring.workflow.ts` → Crawler microservice

```
Sunday 10:00 PM (Cron)
       │
       ▼
┌──────────────────────────────────────┐
│  weekly-competitor-crawl job         │
│                                      │
│  For each competitor in list:        │
│  └─ Enqueue competitor-crawl job    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  competitor-crawl Queue Worker       │
│  (concurrency: 1, retries: 3)       │
│                                      │
│  Calls crawler microservice          │
│  POST http://crawler:3001/analyze    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Crawler Microservice (port 3001)    │
│  Separate Docker container           │
│  Playwright + Chromium               │
│                                      │
│  1. Check robots.txt                 │
│     └─ Respect disallow rules       │
│                                      │
│  2. Launch headless browser          │
│                                      │
│  3. Scrape homepage:                 │
│     ├─ Page title, meta desc        │
│     ├─ H1 tags, OG tags             │
│     ├─ Product listings:            │
│     │   ├─ CSS selector matching    │
│     │   ├─ Link pattern matching    │
│     │   └─ JSON-LD parsing          │
│     ├─ Blog posts (title, URL)      │
│     └─ Navigation links             │
│                                      │
│  4. Follow product listing link      │
│     (if no products on homepage)     │
│                                      │
│  5. Analyze changes vs previous:     │
│     ├─ New/removed products         │
│     ├─ Price changes > 10%          │
│     ├─ New blog posts               │
│     └─ Content freshness score      │
│                                      │
│  6. Generate HTML report             │
│     └─ Saved to /app/reports/       │
│                                      │
│  7. Return full analysis             │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  competitor-monitoring Workflow       │
│  (back in main app)                  │
│                                      │
│  1. Send crawl data to GPT-4o       │
│     └─ Competitive analysis prompt  │
│                                      │
│  2. Log analysis to Sheets           │
│     └─ System Logs tab              │
│                                      │
│  3. Save snapshot to PostgreSQL      │
│     └─ competitor_snapshots table   │
│                                      │
│  4. Check for significant changes:   │
│     ├─ New collections launched     │
│     ├─ Major price drops            │
│     └─ Aggressive promotions        │
│                                      │
│  5. If significant → WhatsApp alert  │
│     └─ To: admin/owner             │
└──────────────────────────────────────┘
```

---

## 11. Scheduled Jobs (Cron)

Four automated cron jobs run on a fixed schedule:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CRON SCHEDULE                               │
│                                                                 │
│  ┌──────────┬─────────────┬────────────────────────────────┐   │
│  │ Time     │ Frequency   │ Job                            │   │
│  ├──────────┼─────────────┼────────────────────────────────┤   │
│  │ 2:00 AM  │ Daily       │ Sheets Sync                    │   │
│  │          │             │ Pull last 3 days of orders     │   │
│  │          │             │ from WooCommerce, reconcile    │   │
│  │          │             │ with Sheets (catch missed      │   │
│  │          │             │ webhooks)                      │   │
│  ├──────────┼─────────────┼────────────────────────────────┤   │
│  │ 6:00 AM  │ Daily       │ Review Requests                │   │
│  │          │             │ Find delivered orders > 5 days │   │
│  │          │             │ with no review sent, enqueue   │   │
│  │          │             │ review-request jobs            │   │
│  ├──────────┼─────────────┼────────────────────────────────┤   │
│  │ 9:00 AM  │ Weekly Mon  │ Content Generation             │   │
│  │          │             │ Fetch all products, enqueue    │   │
│  │          │             │ SEO meta + FAQ generation      │   │
│  │          │             │ jobs for each product          │   │
│  ├──────────┼─────────────┼────────────────────────────────┤   │
│  │ 10:00 PM │ Weekly Sun  │ Competitor Crawl               │   │
│  │          │             │ Enqueue crawl jobs for each    │   │
│  │          │             │ competitor in the list          │   │
│  └──────────┴─────────────┴────────────────────────────────┘   │
│                                                                 │
│  All cron jobs follow the same pattern:                         │
│  1. Query for items that need processing                        │
│  2. Enqueue BullMQ jobs (one per item)                          │
│  3. Return immediately (actual work happens in queue workers)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Complete System Map

All triggers, queues, services, and data stores in one view:

```
  TRIGGERS                    QUEUES (BullMQ/Redis)         EXTERNAL SERVICES
  ────────                    ───────────────────           ─────────────────

  WooCommerce ──webhook──▶  ┌─ order-sync ──────────────▶  Google Sheets
  (order.created)           │   (3 concurrent, 5 retries)   (8 tabs)
  (order.updated)           │
  (product.created)         ├─ notification ─────────────▶  WhatsApp Cloud API
  (product.updated)         │   (5 concurrent, 5 retries)   Nodemailer/SMTP
                            │
  Cron: 2 AM daily ────────▶│                             ▶  WooCommerce API
  Cron: 6 AM daily ────────▶├─ review-request ──────────▶    (read products,
  Cron: Mon 9 AM ──────────▶│   (2 concurrent, 3 retries)    update meta)
  Cron: Sun 10 PM ─────────▶│
                            ├─ content-generation ───────▶  OpenAI GPT-4o
                            │   (2 concurrent, 3 retries)   (text generation)
                            │
                            ├─ creative-generation ──────▶  OpenAI DALL-E 3
                            │   (1 concurrent, 3 retries)   (image generation)
                            │
                            ├─ social-posting ───────────▶  Postiz API
                            │   (1 concurrent, 4 retries)   (social scheduling)
                            │
                            └─ competitor-crawl ─────────▶  Crawler Service
                                (1 concurrent, 3 retries)   (Playwright/3001)


  DATA STORES
  ───────────

  ┌───────────────────┐    ┌────────────────────────────────┐
  │ Redis             │    │ PostgreSQL                     │
  │                   │    │                                │
  │ - Job queues      │    │ - job_logs (audit trail)       │
  │ - Job state       │    │ - webhook_events (raw payloads)│
  │ - Retry tracking  │    │ - cron_runs (execution log)    │
  │ - Delayed jobs    │    │ - competitor_snapshots          │
  │                   │    │ - system_config                │
  └───────────────────┘    └────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │ Google Sheets (primary operational dashboard)             │
  │                                                           │
  │ Orders (17 cols) │ Production (14) │ QC (9) │ Customers (9)│
  │ Creatives (10)   │ System Logs (5) │ Config (4)           │
  │ Competitors (5)                                           │
  └───────────────────────────────────────────────────────────┘
```

---

## Key Design Rules

1. **Services never call services.** A service wraps a single external API. Workflows compose multiple services. This means you can read any service in isolation.

2. **Cron jobs only enqueue.** They never do heavy work directly -- they find items that need processing and create BullMQ jobs. This keeps cron execution fast and gives each item independent retries.

3. **Webhooks are thin.** Verify signature → enqueue job → return 200. Processing happens asynchronously so WooCommerce never times out.

4. **Dependencies flow one way.** Queue workers → workflows → services. Never the reverse. No circular dependencies.

5. **Every job is retryable.** Exponential backoff on all queues. Failed jobs are preserved in Redis for 30 days for manual inspection and replay.
