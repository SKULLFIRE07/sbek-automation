# Runbook

Day-to-day operations guide for the SBEK Automation system.

---

## Monitoring

### Health Endpoints

**Liveness check** -- returns `200` if the process is running:

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"2026-02-27T10:00:00.000Z"}
```

**Deep readiness check** -- verifies Redis and PostgreSQL connections:

```bash
curl http://localhost:3000/health/ready
# {"status":"ready","checks":{"redis":"ok","postgres":"ok"},"timestamp":"..."}
```

If either dependency is down, the response is `503`:

```json
{"status":"degraded","checks":{"redis":"ok","postgres":"error"},"timestamp":"..."}
```

**Crawler health check:**

```bash
curl http://localhost:3001/health
# {"status":"healthy","service":"sbek-crawler","version":"1.0.0","uptime":3600,"timestamp":"..."}
```

### Queue Status

View all queue job counts (waiting, active, completed, failed, delayed):

```bash
curl http://localhost:3000/jobs/status
```

Example response:

```json
{
  "queues": [
    { "name": "order-sync", "waiting": 0, "active": 1, "completed": 142, "failed": 0, "delayed": 0 },
    { "name": "notification", "waiting": 3, "active": 2, "completed": 280, "failed": 1, "delayed": 0 },
    { "name": "review-request", "waiting": 0, "active": 0, "completed": 15, "failed": 0, "delayed": 8 },
    { "name": "content-generation", "waiting": 0, "active": 0, "completed": 50, "failed": 2, "delayed": 0 },
    { "name": "creative-generation", "waiting": 0, "active": 0, "completed": 12, "failed": 0, "delayed": 0 },
    { "name": "social-posting", "waiting": 0, "active": 0, "completed": 8, "failed": 0, "delayed": 0 },
    { "name": "competitor-crawl", "waiting": 0, "active": 0, "completed": 4, "failed": 0, "delayed": 0 }
  ]
}
```

**Key things to watch:**

- `failed > 0` on any queue means jobs have exhausted all retries. Investigate immediately.
- `delayed` on `review-request` is normal -- those are review requests waiting for their 5-day delay to expire.
- `waiting` growing faster than `active` means the workers cannot keep up. Check for API rate limits or service outages.

### System Logs Tab

The **System Logs** tab in Google Sheets provides a human-readable audit trail. Check it for:

- Content generation results (SEO meta, FAQs)
- Competitor analysis summaries
- Creative generation events
- Error entries logged by workflows

### Application Logs

```bash
# All services
docker compose logs -f

# App only
docker compose logs -f app

# Crawler only
docker compose logs -f crawler

# Last 100 lines from app
docker compose logs --tail 100 app
```

In development mode (`NODE_ENV=development`), logs use `pino-pretty` for human-readable formatting. In production, logs are JSON (suitable for log aggregation tools).

---

## Manually Triggering Workflows

### Trigger an order sync

Re-process a specific order as if the webhook just fired:

```bash
# Using the BullMQ CLI or by hitting the webhook endpoint directly.
# Option 1: Simulate a WooCommerce order.created webhook (requires valid HMAC)
# Option 2: Add a job directly via the application code or a one-off script:

npx tsx -e "
import { orderSync } from './src/queues/registry.js';
await orderSync.add('manual-sync-1234', {
  orderId: 1234,
  event: 'order.updated',
  rawPayload: {}  // Will fetch fresh data from WooCommerce
});
console.log('Job enqueued');
process.exit(0);
"
```

### Trigger the daily sheets sync

```bash
npx tsx -e "
import { runDailySheetsSync } from './src/cron/jobs/daily-sheets-sync.js';
await runDailySheetsSync();
console.log('Done');
process.exit(0);
"
```

### Trigger review request processing

```bash
npx tsx -e "
import { runDailyReviewRequests } from './src/cron/jobs/daily-review-requests.js';
await runDailyReviewRequests();
console.log('Done');
process.exit(0);
"
```

### Trigger content generation for a specific product

```bash
npx tsx -e "
import { contentGeneration } from './src/queues/registry.js';

// SEO meta generation
await contentGeneration.add('manual-seo-501', {
  productId: 501,
  productName: 'Celestial Gold Ring',
  type: 'seo_meta'
});

// FAQ generation
await contentGeneration.add('manual-faq-501', {
  productId: 501,
  productName: 'Celestial Gold Ring',
  type: 'faq'
});

console.log('Jobs enqueued');
process.exit(0);
"
```

### Trigger creative generation for a product

```bash
npx tsx -e "
import { creativeGeneration } from './src/queues/registry.js';
await creativeGeneration.add('manual-creative-501', {
  productId: 501,
  productName: 'Celestial Gold Ring',
  productDescription: 'Handcrafted 18K gold ring with celestial diamond design',
  productImageUrl: 'https://your-store.com/wp-content/uploads/celestial-ring.jpg',
  category: 'Rings',
  variants: ['white_bg', 'lifestyle', 'festive']
});
console.log('Job enqueued');
process.exit(0);
"
```

### Trigger a competitor crawl

```bash
npx tsx -e "
import { competitorCrawl } from './src/queues/registry.js';
await competitorCrawl.add('manual-crawl-competitor-a', {
  competitorName: 'Competitor A',
  url: 'https://example-competitor-a.com'
});
console.log('Job enqueued');
process.exit(0);
"
```

### Trigger the full weekly competitor crawl

```bash
npx tsx -e "
import { runWeeklyCompetitorCrawl } from './src/cron/jobs/weekly-competitor-crawl.js';
await runWeeklyCompetitorCrawl();
console.log('Done');
process.exit(0);
"
```

### Send a test notification

```bash
npx tsx -e "
import { notification } from './src/queues/registry.js';
await notification.add('test-notification', {
  channel: 'email',
  recipientEmail: 'test@example.com',
  recipientName: 'Test User',
  templateName: 'order_confirmation',
  templateData: {
    customer_name: 'Test User',
    order_id: '9999',
    product_name: 'Test Product',
    amount: '10000',
    delivery_date: '2026-03-15'
  }
});
console.log('Notification job enqueued');
process.exit(0);
"
```

---

## Managing Team Members (Production Assignment)

Production assignment is managed through the Google Sheets **Production** tab and the `createProductionTask` workflow.

### View current production assignments

Open the **Production** tab in Google Sheets. Filter the **Assigned To** column to see who has what work.

### Assign an order to a team member

Option 1: **Manually in Sheets** -- edit the "Assigned To" cell in the Production tab for the relevant order.

Option 2: **Via workflow** -- when triggering production task creation, pass the `assignee` parameter:

```bash
npx tsx -e "
import { createProductionTask } from './src/workflows/production-tracking.workflow.js';
await createProductionTask({
  orderId: 1234,
  status: 'in_production',
  assignee: 'Rajesh K',
  notes: 'Rush order - priority'
});
process.exit(0);
"
```

### Reassign an order

Edit the **Assigned To** cell directly in the Production tab. Then update the **Notes** column to explain the reassignment. The system does not send automatic notifications on reassignment -- you need to manually inform the new assignee.

### Add a new team member

Currently, team members are not stored in a central registry. To add a new team member:

1. Simply start using their name in the **Assigned To** column
2. For WhatsApp production briefs to reach the new member, their phone number needs to be configured (this feature is pending -- currently production briefs use an empty phone placeholder)

### Remove a team member

1. Reassign all their active production tasks in the **Production** tab
2. No other system changes needed

---

## Updating QC Checklist Items

The default QC checklist is defined in `src/workflows/qc-tracking.workflow.ts`:

```typescript
const DEFAULT_CHECKLIST = [
  'Dimensions match order specs',
  'Metal finish quality',
  'Stone setting secure',
  'Engraving accuracy',
  'Surface polish',
  'Packaging condition',
];
```

### To modify the default checklist

1. Edit the `DEFAULT_CHECKLIST` array in `/home/aryan-budukh/Desktop/SBEK/sbek-automation/src/workflows/qc-tracking.workflow.ts`
2. Rebuild: `npm run build`
3. Restart the app: `docker compose restart app`

New checklist items only apply to **future** QC checklists. Existing QC rows in Google Sheets are not retroactively updated.

### To add a QC item for a specific order

Edit the **QC** tab in Google Sheets directly. Add a new row with the Order ID, Product, today's date, the checklist item name, and set Pass/Fail to `Pending`.

### To mark a QC item as Pass or Fail

In the **QC** tab, update the **Pass/Fail** column for the relevant row to `Pass` or `Fail`. Add notes in the **Notes** column and any corrective action in the **Action Taken** column.

### To evaluate QC results for an order

After all checklist items are marked, trigger evaluation:

```bash
npx tsx -e "
import { evaluateQCResults } from './src/workflows/qc-tracking.workflow.js';
const result = await evaluateQCResults(1234);
console.log('QC result:', result);  // 'passed' or 'failed'
process.exit(0);
"
```

If all items are `Pass`, the order status advances and the customer is notified. If any item is `Fail`, the order is sent back to production as a rework.

---

## Adding a New Competitor to Monitor

### Option 1: Edit the code (current approach)

The competitor list is in `src/cron/jobs/weekly-competitor-crawl.ts`:

```typescript
const DEFAULT_COMPETITORS = [
  { name: 'Competitor A', url: 'https://example-competitor-a.com' },
  { name: 'Competitor B', url: 'https://example-competitor-b.com' },
];
```

1. Add a new entry to the array
2. Rebuild: `npm run build`
3. Restart: `docker compose restart app`

### Option 2: Add to the Competitors tab in Sheets

The setup script creates a **Competitors** tab with columns: Name, URL, Category, Last Crawled, Notes. In a future version, the weekly crawl job will read from this tab. For now, this tab serves as a reference list.

### Trigger a one-off crawl for a new competitor

```bash
npx tsx -e "
import { competitorCrawl } from './src/queues/registry.js';
await competitorCrawl.add('crawl-new-competitor', {
  competitorName: 'New Competitor',
  url: 'https://new-competitor.com'
});
console.log('Crawl job enqueued');
process.exit(0);
"
```

### View crawl reports

Crawl reports are saved as HTML files in the `reports/` directory:

```bash
ls -la reports/
# 2026-02-23-competitor-a.html
# 2026-02-23-competitor-b.html
```

You can also list them via the crawler API:

```bash
curl http://localhost:3001/reports
```

Open the HTML files in a browser for a styled competitor analysis report with product listings, price comparisons, blog posts, SEO health scores, and content freshness ratings.

---

## Modifying Email Templates

Email templates are Handlebars (`.hbs`) files in `src/templates/email/`. They are compiled once at service startup.

### Current templates

| File                       | Trigger                              | Subject Line                                  |
|---------------------------|--------------------------------------|-----------------------------------------------|
| `order-confirmation.hbs`  | New order                            | Thank you for your SBEK order!                |
| `production-started.hbs`  | Order enters production              | Your SBEK piece is being crafted              |
| `qc-passed.hbs`           | QC passed                            | Your SBEK order passed quality check!         |
| `shipped.hbs`             | Order shipped                        | Your SBEK order is on its way!                |
| `delivered.hbs`           | Order delivered                      | Your SBEK order has been delivered            |
| `review-request.hbs`      | 5 days after delivery                | We'd love your feedback on your SBEK purchase |

### To modify an email template

1. Edit the `.hbs` file in `src/templates/email/`
2. Available template variables (passed as `templateData`):
   - `customer_name` -- customer's name
   - `order_id` -- order number
   - `product_name` -- product name(s)
   - `amount` -- order total
   - `delivery_date` -- promised delivery date
   - `tracking_number`, `tracking_url`, `carrier_name` -- for shipped template
   - `review_url` -- for review request template
3. Available Handlebars helpers:
   - `{{formatDate someDate}}` -- formats as "27 Feb 2026"
   - `{{formatCurrency amount}}` -- formats as Indian Rupees (e.g., "45,000")
4. Rebuild and restart: `npm run build && docker compose restart app`

### To add a new email template

1. Create a new `.hbs` file in `src/templates/email/` (e.g., `back-in-stock.hbs`)
2. The template is auto-loaded at startup -- the filename (without `.hbs`) becomes the template name
3. Add a subject line mapping in `src/queues/definitions/notification.queue.ts`:
   ```typescript
   const emailSubjects: Record<string, string> = {
     // ... existing entries
     'back-in-stock': 'Good news! Your wishlist item is back in stock',
   };
   ```
4. Rebuild and restart

### To change an email subject line

Edit the `emailSubjects` map in `src/queues/definitions/notification.queue.ts`.

---

## Modifying WhatsApp Templates

WhatsApp templates must be approved by Meta before they can be used. The template definitions are in `src/templates/whatsapp/templates.json` for reference, but the actual templates live in Meta's WhatsApp Manager.

### Current templates

| Template Name       | Category  | Purpose                    | Parameters              |
|--------------------|-----------|----------------------------|-------------------------|
| `order_confirmation` | UTILITY  | New order confirmation     | name, order_id, product, delivery_date |
| `production_started` | UTILITY  | Crafting has started       | name, product, order_id  |
| `qc_passed`         | UTILITY   | QC passed notification     | name, product            |
| `order_shipped`     | UTILITY   | Shipping notification      | name, order_id, tracking_url |
| `order_delivered`   | UTILITY   | Delivery confirmation      | name, product            |
| `review_request`    | MARKETING | Review request (5-day)     | name, product, review_url |
| `production_brief`  | UTILITY   | Internal: artisan brief    | order_id, product, customer, size, metal, engraving, due_date |
| `qc_failed_alert`   | UTILITY   | Internal: QC failure alert | order_id, issues         |

### To modify a WhatsApp template

1. Go to [Meta WhatsApp Manager](https://business.facebook.com/wa/manage/message-templates/)
2. Find the template and click **Edit** (or create a new version)
3. Modify the body text. Ensure `{{1}}`, `{{2}}`, etc. match the parameter order the code sends
4. Submit for approval
5. Update `src/templates/whatsapp/templates.json` to match (this file is reference documentation)
6. If the template **name** changed, update the `templateName` references in the relevant workflow files

### To add a new WhatsApp template

1. Create the template in Meta WhatsApp Manager
2. Wait for approval (UTILITY templates typically approve in minutes)
3. Add a reference entry to `src/templates/whatsapp/templates.json`
4. Use the template name in your workflow code when calling `notification.add()`

---

## Approving Creatives and Scheduling Posts

### View generated creatives

Open the **Creatives** tab in Google Sheets. Filter by **Status = Generated** to see creatives awaiting review.

Each row includes:
- **Product ID / Name** -- which product
- **Variant** -- which creative style (white_bg, lifestyle, festive, etc.)
- **Image URL** -- link to the DALL-E generated image
- **Generated Date** -- when it was created

### Approve a creative

1. Open the Image URL to review the creative
2. In the Creatives tab, change **Status** to `Approved`
3. Fill in **Approved By** with your name

### Reject a creative

1. Change **Status** to `Rejected`
2. Add notes explaining why (optional)
3. To regenerate, trigger a new creative generation job for that product

### Schedule an approved creative for posting

```bash
npx tsx -e "
import { socialPosting } from './src/queues/registry.js';
await socialPosting.add('schedule-post-501-lifestyle', {
  platform: 'all',
  imageUrl: 'https://oaidalleapiprodscus.blob.core.windows.net/...',
  caption: 'Your AI-generated caption here with #hashtags',
  productName: 'Celestial Gold Ring',
  scheduledFor: '2026-03-01T10:00:00Z'
});
console.log('Post scheduled');
process.exit(0);
"
```

After scheduling:
- The social-posting worker uploads the image to Postiz
- Creates a draft/scheduled post on Instagram + Facebook
- You can review and adjust the schedule in the Postiz dashboard

### Update the Creatives tab after posting

After a creative has been posted, update the **Creatives** tab:
- Set **Status** to `Posted`
- Fill in **Posted Date**

---

## Monthly Maintenance Tasks

### 1. Review and clean up queue failures

```bash
# Check for failed jobs across all queues
curl http://localhost:3000/jobs/status | python3 -m json.tool
```

For any queue with `failed > 0`, investigate the failures in the application logs:

```bash
docker compose logs app | grep "failed" | tail -20
```

### 2. Database maintenance

```bash
# Check database size
docker compose exec postgres psql -U sbek -d sbek -c "
  SELECT pg_size_pretty(pg_database_size('sbek'));
"

# Count rows in each table
docker compose exec postgres psql -U sbek -d sbek -c "
  SELECT 'job_logs' as table_name, count(*) FROM job_logs
  UNION ALL SELECT 'webhook_events', count(*) FROM webhook_events
  UNION ALL SELECT 'cron_runs', count(*) FROM cron_runs
  UNION ALL SELECT 'competitor_snapshots', count(*) FROM competitor_snapshots
  UNION ALL SELECT 'system_config', count(*) FROM system_config;
"

# Clean up old job logs (older than 90 days)
docker compose exec postgres psql -U sbek -d sbek -c "
  DELETE FROM job_logs WHERE created_at < NOW() - INTERVAL '90 days';
"

# Clean up old webhook events (older than 90 days)
docker compose exec postgres psql -U sbek -d sbek -c "
  DELETE FROM webhook_events WHERE created_at < NOW() - INTERVAL '90 days';
"
```

### 3. Docker maintenance

```bash
# Check disk usage
docker system df

# Remove unused images and build cache
docker system prune -f

# Update base images
docker compose pull redis postgres
docker compose up -d
```

### 4. Dependency updates

```bash
# Check for outdated packages
npm outdated

# Update patch/minor versions
npm update

# Rebuild and test
npm run build && npm test
```

### 5. Review System Logs tab

Open the **System Logs** tab in Google Sheets. Review entries from the past month for:

- Repeated errors from any source
- Content generation failures (OpenAI API issues)
- Crawler failures (blocked by competitors)

Consider archiving old rows (move to an "Archive" tab) if the tab grows beyond 5,000 rows.

### 6. Verify WhatsApp token

WhatsApp Cloud API temporary tokens expire after 24 hours. If you are using a temporary token:

1. Go to Meta WhatsApp API Setup
2. Generate a new token
3. Update `WHATSAPP_ACCESS_TOKEN` in `.env`
4. Restart: `docker compose restart app`

For production, use a System User permanent token from Meta Business Manager.

### 7. Check OpenAI usage

1. Go to [platform.openai.com/usage](https://platform.openai.com/usage)
2. Review GPT-4o and DALL-E 3 usage for the month
3. Verify you are within budget
4. Update the `openai_image_credits` config value in the Sheets Config tab if needed

### 8. Review crawler reports

```bash
ls -la reports/
```

Open recent HTML reports in a browser. Check if competitors have:
- Launched new collections
- Changed pricing strategies
- Published new content
- Updated their SEO

### 9. Redis memory check

```bash
docker compose exec redis redis-cli INFO memory | grep used_memory_human
```

If memory usage is high (>500MB), check for stuck delayed jobs or increase the cleanup frequency.

---

## What to Do When Automation Fails

### Step 1: Identify the failure

```bash
# Check queue status for failed jobs
curl -s http://localhost:3000/jobs/status | python3 -m json.tool

# Check application logs for errors
docker compose logs --tail 200 app | grep -i "error\|failed"

# Check if services are healthy
curl -s http://localhost:3000/health/ready | python3 -m json.tool
```

### Step 2: Diagnose the root cause

| Symptom | Likely Cause | Check |
|---------|-------------|-------|
| All queues stuck at `waiting: 0, active: 0` | Redis down | `docker compose ps redis` |
| order-sync failures | WooCommerce API down or credentials expired | Check WooCommerce admin, verify `WOO_CONSUMER_KEY` |
| notification failures | WhatsApp token expired or SMTP blocked | Check Meta dashboard; try `npm run dev` and send a test email |
| content-generation failures | OpenAI API key invalid or quota exceeded | Check [platform.openai.com](https://platform.openai.com/) billing |
| creative-generation failures | DALL-E content policy rejection | Check logs for the rejected prompt |
| competitor-crawl failures | Crawler microservice down or site blocking | `docker compose ps crawler`; check robots.txt |
| Sheets errors | Google token expired or sheet unshared | Re-run `npm run setup:sheets` |

### Step 3: Fix and retry

**If the service is back up and you need to reprocess failed jobs:**

Most jobs can be re-triggered by running the appropriate cron job manually:

```bash
# Re-sync orders from last 3 days
npx tsx -e "
import { runDailySheetsSync } from './src/cron/jobs/daily-sheets-sync.js';
await runDailySheetsSync();
process.exit(0);
"

# Re-process review requests
npx tsx -e "
import { runDailyReviewRequests } from './src/cron/jobs/daily-review-requests.js';
await runDailyReviewRequests();
process.exit(0);
"

# Re-generate content
npx tsx -e "
import { runWeeklyContentGeneration } from './src/cron/jobs/weekly-content-generation.js';
await runWeeklyContentGeneration();
process.exit(0);
"
```

### Step 4: Manual fallback procedures

If automation is completely down and you need to handle operations manually:

**Order management:**
- Check WooCommerce admin directly for new orders
- Manually add rows to the Orders tab in Google Sheets
- Send order confirmations manually via WhatsApp Business app

**Customer communications:**
- Use the WhatsApp Business app to send messages manually
- Use Gmail to send order updates manually
- Use the email templates in `src/templates/email/` as a reference for what to include

**Production tracking:**
- Update the Production and QC tabs in Google Sheets directly
- Assign work verbally or via WhatsApp group

**Content and creatives:**
- Use ChatGPT directly to generate SEO content
- Use DALL-E or other image generators for ad creatives
- Post to social media manually via native platform apps

### Step 5: Post-incident

After resolving the issue:

1. Check the System Logs tab for any entries that indicate data inconsistencies
2. Run the daily sheets sync to reconcile orders: `npx tsx -e "import { runDailySheetsSync } from './src/cron/jobs/daily-sheets-sync.js'; await runDailySheetsSync(); process.exit(0);"`
3. Verify queue status returns to healthy: `curl http://localhost:3000/jobs/status`
4. Add a note to the System Logs tab (manually) documenting what happened and how it was resolved
