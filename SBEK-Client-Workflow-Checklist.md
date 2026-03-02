# SBEK Automation — Client Workflow Verification Checklist

> **Prepared by:** 360 Labs | **For:** SBEK Team
> **Purpose:** Step-by-step guide for the client to verify every automation workflow is working correctly.
> **Instructions:** Go through each section, perform the test, check the expected result, and mark Status as PASS / FAIL.

---

## 1. Order Sync (WooCommerce → Google Sheets)

| # | What to Test | How to Test | Expected Result | Status |
|---|-------------|-------------|-----------------|--------|
| 1.1 | New Order Auto-Sync | Place a **test order** on the WooCommerce store | Order row appears in Google Sheets **Orders** tab within 1-2 minutes with all details: Order ID, Customer Name, Email, Phone, Product, Amount (₹), Status = "New", Ring Size, Metal Type, Stone Type, Engraving, Promised Delivery Date | ☐ |
| 1.2 | Daily Reconciliation | Check **System Logs** tab next morning after 2:00 AM | Log entry shows "daily-sheets-sync" completed — any orders missed by webhooks in the last 3 days are now filled in | ☐ |
| 1.3 | Status Dropdown | Click the **Status** cell of any order in Orders tab | Dropdown shows: New → In Production → QC → Shipped → Delivered. Rows are color-coded by status | ☐ |

---

## 2. Customer Communication (Email + WhatsApp)

| # | What to Test | How to Test | Expected Result | Status |
|---|-------------|-------------|-----------------|--------|
| 2.1 | Order Confirmation | Place a test order | Customer receives **(a)** WhatsApp: Order ID, product name, amount in ₹ **(b)** Email: Branded HTML with order summary + expected delivery date | ☐ |
| 2.2 | Production Started | Change order status to **"In Production"** | Customer receives **(a)** WhatsApp: "Your piece is now being crafted" **(b)** Email: Branded production started notification | ☐ |
| 2.3 | QC Passed | Mark all 6 QC checkpoints as **Pass** | Customer receives Email: "Almost ready for you" — quality certification notification | ☐ |
| 2.4 | Shipped | Change order status to **"Shipped"** + add tracking number | Customer receives **(a)** WhatsApp: tracking number + carrier link **(b)** Email: Shipping notification with tracking URL | ☐ |
| 2.5 | Delivered | Change order status to **"Delivered"** | Customer receives **(a)** WhatsApp: "Hope you love it" + care instructions **(b)** Email: Delivery confirmation with jewelry care tips | ☐ |
| 2.6 | Review Request (5-Day) | Wait 5 days after "Delivered" OR check 6:00 AM cron log | Customer receives **(a)** WhatsApp: Review request with link **(b)** Email: Review request with direct link to review page | ☐ |

**Templates used:** 6 branded email templates (Handlebars) + 7 WhatsApp pre-approved templates

---

## 3. Production Task Automation

| # | What to Test | How to Test | Expected Result | Status |
|---|-------------|-------------|-----------------|--------|
| 3.1 | Auto Production Task | Place an order with custom details (ring size, metal, engraving) | **Production** tab shows new row with: Order ID, Product, Ring Size, Metal Type, Stone Type, Engraving Text, Reference Image Link, Due Date (auto-calculated), Assigned Craftsperson | ☐ |
| 3.2 | Craftsperson Assignment | Check the "Assigned To" column in Production tab | Craftsperson auto-assigned based on product type. Production team receives WhatsApp brief with order details + reference images | ☐ |
| 3.3 | Production Status Flow | Update production status: Pending → In Progress → Completed | Status changes reflect in real-time. When "Completed" → QC checklist triggers automatically | ☐ |

---

## 4. Quality Control Tracking

| # | What to Test | How to Test | Expected Result | Status |
|---|-------------|-------------|-----------------|--------|
| 4.1 | QC Checklist Auto-Created | Mark a production task as "Completed" | **QC** tab shows 6 new rows for that order: Dimensions, Finish, Stone Setting, Engraving, Polish, Packaging — each with Pass/Fail, Photo URL, Inspector columns | ☐ |
| 4.2 | QC Pass → Ready to Ship | Mark all 6 checkpoints as "Pass" | Order status automatically moves to ready for shipping. Customer receives QC Passed email | ☐ |
| 4.3 | QC Fail → Rework | Mark any checkpoint as "Fail" + add notes | **(a)** Order routed back to Production tab with rework notes **(b)** Internal WhatsApp alert sent to team **(c)** QC history preserved — nothing deleted | ☐ |

---

## 5. SEO Automation

| # | What to Test | How to Test | Expected Result | Status |
|---|-------------|-------------|-----------------|--------|
| 5.1 | Auto Meta Title & Description | Add a new product to WooCommerce | Yoast SEO fields populated: **(a)** Meta title under 60 characters with keywords **(b)** Meta description under 160 characters | ☐ |
| 5.2 | FAQ Generation + Schema | Check product page source code | **(a)** 5 Q&A pairs visible on the page **(b)** JSON-LD FAQPage schema in page source. Verify with [Google Rich Results Test](https://search.google.com/test/rich-results) | ☐ |
| 5.3 | Schema Markup | Use Google Structured Data Testing Tool on any product page | Valid JSON-LD for: **(a)** Product schema (name, price, brand) **(b)** Organization schema **(c)** FAQ schema | ☐ |
| 5.4 | Weekly Content Batch | Check **System Logs** tab on Monday after 9:00 AM IST | Log shows "weekly-content-generation" with count of products processed | ☐ |

---

## 6. AI Search Optimization (AEO)

| # | What to Test | How to Test | Expected Result | Status |
|---|-------------|-------------|-----------------|--------|
| 6.1 | AEO Knowledge Base | Check website for brand knowledge base page | AI-readable page exists with: brand story, product categories, USPs, pricing ranges — optimized for ChatGPT / Perplexity / Google AI | ☐ |
| 6.2 | Comparison Content | Check for comparison articles on the site | Articles like "Gold vs Platinum Rings" exist that AI assistants can cite | ☐ |
| 6.3 | FAQ Pages with Schema | Search product-related questions on site | Dedicated FAQ pages with proper structured markup, crawlable by AI search engines | ☐ |

---

## 7. Ad Creative Generation

| # | What to Test | How to Test | Expected Result | Status |
|---|-------------|-------------|-----------------|--------|
| 7.1 | 5 Creative Variants | Trigger creative generation for a product → Check Google Drive | **5 images generated:** (1) White background — e-commerce style (2) Lifestyle — elegant event (3) Festive — Diwali/wedding theme (4) Minimal text overlay (5) Story format — vertical 9:16 | ☐ |
| 7.2 | Multi-Platform Sizes | Check image sizes in Google Drive | Each variant in **4 sizes:** Instagram 1080×1080, Facebook 1200×628, Google Display 300×250, Stories 1080×1920 | ☐ |
| 7.3 | Creatives Logged | Open **Creatives** tab in Google Sheets | Each creative logged with: Product, Variant Type, Image URL, Drive Link, Size, Status, Date | ☐ |

**Image generation:** Uses DALL-E 3 + Google Gemini. Credits: ₹50 per image.

---

## 8. Social Media Scheduling (Postiz)

| # | What to Test | How to Test | Expected Result | Status |
|---|-------------|-------------|-----------------|--------|
| 8.1 | Auto-Upload to Postiz | Log into Postiz dashboard after creatives are generated | **(a)** Images appear in Postiz media library **(b)** Draft posts created with AI-generated captions **(c)** Ready for team review | ☐ |
| 8.2 | Scheduled Publishing | Approve a draft post in Postiz → Schedule it | Post goes live on Instagram/Facebook at the scheduled time. Postiz shows "Published" status | ☐ |
| 8.3 | Analytics | Check Postiz analytics 24+ hours after a post goes live | Engagement metrics visible: likes, comments, shares, reach — all in one dashboard | ☐ |

**Platforms:** Instagram, Facebook (+ LinkedIn, Twitter/X, Pinterest if connected in Postiz)

---

## 9. Competitor Monitoring (AEO360)

| # | What to Test | How to Test | Expected Result | Status |
|---|-------------|-------------|-----------------|--------|
| 9.1 | Weekly Automated Crawl | Check **System Logs** tab on Monday morning | Log entries show "weekly-competitor-crawl" for each competitor — extracts: products, prices, blog posts, SEO metadata | ☐ |
| 9.2 | AI-Powered Analysis | Check **Competitors** tab or System Logs | Analysis report per competitor: what changed, new products, price changes, SEO shifts, actionable recommendations | ☐ |
| 9.3 | Significant Change Alerts | Review admin WhatsApp for alerts | Admin gets WhatsApp alert like: "Competitor X launched a new collection" or "Competitor Y ranking for keywords you're missing" | ☐ |
| 9.4 | Historical Tracking | Compare this week's report to last week's | Trends visible over time — all crawl snapshots stored for historical comparison | ☐ |

**Crawl schedule:** Every Sunday 10:00 PM IST. **Competitors monitored:** 5-10 (configured in Competitors tab).

---

## 10. Admin Dashboard & System Health

| # | What to Test | How to Test | Expected Result | Status |
|---|-------------|-------------|-----------------|--------|
| 10.1 | System Health | Open admin dashboard → Home page | All services green: Main App ✓, Redis ✓, PostgreSQL ✓, Crawler ✓. Any failure shows red with error | ☐ |
| 10.2 | Queue Monitoring | Navigate to **Queues** page | All 7 queues visible: order-sync, notification, review-request, content-generation, creative-generation, social-posting, competitor-crawl. Each shows Waiting / Active / Completed / Failed / Delayed counts | ☐ |
| 10.3 | Activity Feed | Check **Activity** page | Chronological list of recent jobs with timestamps, success/failure status, and error details for failed jobs | ☐ |
| 10.4 | Settings Management | Navigate to **Settings** page | All API keys listed (masked): WooCommerce, Google, WhatsApp, OpenAI, Gemini, Postiz, SMTP. Keys can be updated without restarting | ☐ |
| 10.5 | Cron Job History | Check **System** page | Table of all cron runs: 2 AM Sheets Sync, 6 AM Review Requests, 9 AM Mon Content Gen, 10 PM Sun Competitor Crawl — each with last run time + result | ☐ |

---

## Google Sheets Tabs — Verify All 8 Exist

| # | Tab Name | Key Columns | Status |
|---|----------|-------------|--------|
| S.1 | **Orders** | Order ID, Date, Customer, Email, Phone, Product, Qty, Amount (₹), Status, Ring Size, Metal, Stone, Engraving, Reference Image, Promised Delivery, Assigned To, Notes | ☐ |
| S.2 | **Production** | Order ID, Product, Craftsperson, Start Date, Due Date, Status, Ring Size, Metal, Stones, Engraving, Reference Image, Priority, Completion Date, Notes | ☐ |
| S.3 | **QC** | Order ID, Item, Checkpoint, Result (Pass/Fail), Photo URL, Inspector, Action Required, Date, Notes | ☐ |
| S.4 | **Customers** | Customer ID, Name, Email, Phone, Total Orders, Total Spend (₹), Last Order Date, Tags, Notes | ☐ |
| S.5 | **Creatives** | Product, Variant, Image URL, Drive Link, Size, Status, Generated Date, Posted Date, Platform, Notes | ☐ |
| S.6 | **System Logs** | Timestamp, Level, Source, Message, Details | ☐ |
| S.7 | **Config** | Key, Value, Description, Last Updated | ☐ |
| S.8 | **Competitors** | Name, URL, Category, Last Crawled, Notes | ☐ |

---

## Summary: What Runs Automatically (No Manual Work)

| Trigger | What Happens Automatically |
|---------|---------------------------|
| New order placed | → Synced to Sheets → Production task created → Customer gets confirmation (WhatsApp + Email) |
| Status changed | → Customer notified at every stage (6 touchpoints) |
| Production completed | → QC checklist created automatically |
| QC passed | → Customer notified → Ready for shipping |
| QC failed | → Rework routed back → Team alerted on WhatsApp |
| Order delivered | → 5-day timer starts → Review request sent automatically |
| New product added | → SEO meta generated → FAQ created → Schema injected → Ad creatives generated → Uploaded to Postiz |
| Every Monday 9 AM | → All products get refreshed SEO content |
| Every Sunday 10 PM | → All competitors crawled → AI analysis → Alerts sent |
| Every day 2 AM | → Orders reconciled between WooCommerce and Sheets |
| Every day 6 AM | → Missed review requests caught and sent |

---

*Your team focuses on: Making jewelry, quality control, customer relationships, creative direction.*
*The system handles: Data entry, notifications, reminders, content generation, creative variants, competitor tracking, social publishing.*
