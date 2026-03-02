import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import {
  jobLogs,
  webhookEvents,
  cronRuns,
  competitorSnapshots,
} from '../src/db/schema.js';

/**
 * SBEK Demo Setup — ONE script to set up everything
 *
 * Sets up:
 *   ✅ Google Sheets: Order, Customer, Competitors, Creatives, System Logs
 *   ✅ Dashboard DB:  Job logs, Webhook events, Cron runs, Competitor snapshots
 *   ✅ Order status = "New" — ready for manual walkthrough
 *
 * Usage: npx tsx scripts/demo-setup.ts
 */

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ── Order data ──────────────────────────────────────────────────────────

const ORDER = {
  id: 10247,
  customer: 'Aryan Budukh',
  phone: '+919876543210',
  email: process.env.SMTP_USER || 'aryansbudukh@gmail.com',
  product: 'Arka Frost Terra Ring',
  variant: '925 Sterling Silver / Size 8 / Blue Topaz',
  size: '8',
  metal: '925 Sterling Silver',
  stones: 'Blue Topaz, CZ Accent',
  engraving: 'Forever Yours',
  amount: '₹12,499',
};

// ── Helpers ─────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600000);
}
function daysAgo(d: number) {
  const date = new Date();
  date.setDate(date.getDate() - d);
  date.setHours(randomBetween(8, 22), randomBetween(0, 59));
  return date;
}

// ── Data pools ──────────────────────────────────────────────────────────

const customers = [
  'Priya Sharma', 'Rahul Mehra', 'Ananya Patel', 'Vikram Singh',
  'Neha Gupta', 'Arjun Reddy', 'Kavita Iyer', 'Sanjay Kapoor',
];

const products = [
  'Gold Necklace Set', 'Diamond Ring', 'Kundan Earrings', 'Polki Choker Set',
  'Temple Bangles', 'Meenakari Pendant', 'Ruby Maang Tikka', 'Pearl Jhumkas',
];

const queueNames = [
  'order-sync', 'notification', 'review-request', 'content-generation',
  'creative-generation', 'social-posting', 'competitor-crawl',
];

const cronJobNames = [
  'order-sync-cron', 'review-request-cron', 'competitor-crawl-cron', 'content-generation-cron',
];

const compList = [
  { name: 'Tanishq', url: 'https://www.tanishq.co.in' },
  { name: 'CaratLane', url: 'https://www.caratlane.com' },
  { name: 'BlueStone', url: 'https://www.bluestone.com' },
  { name: 'Kalyan Jewellers', url: 'https://www.kalyanjewellers.net' },
  { name: 'Malabar Gold', url: 'https://www.malabargoldanddiamonds.com' },
];

// ── Main ────────────────────────────────────────────────────────────────

async function setup() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          SBEK — FULL DEMO SETUP                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const { sheets } = await import('../src/services/googlesheets.service.js');
  await sheets.init();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PART A: GOOGLE SHEETS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // 1. Order
  console.log('[1/7] Orders tab — creating order #10247...');
  const existing = await sheets.findOrderRow(String(ORDER.id));
  if (existing !== null) {
    await sheets.updateOrder(String(ORDER.id), { 'Status': 'New', 'Last Updated': new Date().toISOString() });
    console.log('  ✅ Existing order reset to "New"');
  } else {
    const orderDate = new Date().toISOString().split('T')[0];
    const deliveryDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    await sheets.appendOrder({
      'Order ID': String(ORDER.id),
      'Customer Name': ORDER.customer,
      'Phone': ORDER.phone,
      'Email': ORDER.email,
      'Product': ORDER.product,
      'Variant': ORDER.variant,
      'Size': ORDER.size,
      'Metal': ORDER.metal,
      'Stones': ORDER.stones,
      'Engraving': ORDER.engraving,
      'Amount': ORDER.amount,
      'Order Date': orderDate,
      'Promised Delivery': deliveryDate,
      'Status': 'New',
      'Production Assignee': '',
      'Notes': '',
      'Last Updated': new Date().toISOString(),
    });
    console.log('  ✅ Order #10247 created');
  }

  // 2. Customer
  console.log('[2/7] Customers tab...');
  await sheets.upsertCustomer({
    'Customer ID': '1001',
    'Name': ORDER.customer,
    'Email': ORDER.email,
    'Phone': ORDER.phone,
    'Total Orders': '1',
    'Total Spend': ORDER.amount,
    'Last Order Date': new Date().toISOString().split('T')[0],
    'Tags': 'VIP',
    'Notes': '',
  });
  console.log('  ✅ Customer: Aryan Budukh');

  // 3. Competitors
  console.log('[3/7] Competitors tab...');
  const existingComp = await sheets.getCompetitors();
  if (existingComp.length === 0) {
    await sheets.appendCompetitor({ Name: 'Tanishq', URL: 'https://www.tanishq.co.in', Active: 'Yes' });
    await sheets.appendCompetitor({ Name: 'CaratLane', URL: 'https://www.caratlane.com', Active: 'Yes' });
    await sheets.appendCompetitor({ Name: 'BlueStone', URL: 'https://www.bluestone.com', Active: 'Yes' });
    console.log('  ✅ 3 competitors added');
  } else {
    console.log(`  ✅ ${existingComp.length} competitors already exist`);
  }

  // 4. Creatives
  console.log('[4/7] Creatives tab...');
  await sheets.appendCreative({
    'Product ID': '23504',
    'Product Name': ORDER.product,
    'Variant': 'White Background',
    'Creative Type': 'Product Photo',
    'Image URL': '',
    'Drive Link': '',
    'Generated Date': new Date().toISOString().split('T')[0],
    'Status': 'Pending',
    'Approved By': '',
    'Posted Date': '',
  });
  console.log('  ✅ Creative row added (Pending)');

  // 5. System Logs
  console.log('[5/7] System Logs tab...');
  await sheets.logEvent('INFO', 'demo-setup', `Demo order #${ORDER.id} created for ${ORDER.customer}`, JSON.stringify({ product: ORDER.product }));
  console.log('  ✅ Log entry added');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PART B: DATABASE (for Dashboard)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // 6. Webhook events (50 events for Recent Activity)
  console.log('[6/7] Dashboard DB — seeding webhook events, job logs, cron runs...');

  const webhookData = [];
  const sources = [
    { source: 'woocommerce', events: ['order.created', 'order.updated', 'order.completed'] },
    { source: 'stripe', events: ['payment.succeeded'] },
    { source: 'sheets-poller', events: ['status.in_production', 'status.qc', 'status.ready_to_ship', 'status.shipped', 'status.delivered'] },
  ];
  for (let i = 0; i < 50; i++) {
    const sg = randomFrom(sources);
    const createdAt = daysAgo(randomBetween(0, 5));
    webhookData.push({
      source: sg.source,
      event: randomFrom(sg.events),
      payload: {
        orderId: 10200 + i,
        customer: randomFrom(customers),
        product: randomFrom(products),
        amount: `₹${randomBetween(5000, 150000).toLocaleString('en-IN')}`,
      },
      processed: Math.random() < 0.95,
      processedAt: Math.random() < 0.95 ? new Date(createdAt.getTime() + randomBetween(500, 15000)) : null,
      createdAt,
    });
  }
  // Add the real order event at the top
  webhookData.push({
    source: 'woocommerce',
    event: 'order.created',
    payload: { orderId: ORDER.id, customer: ORDER.customer, product: ORDER.product, amount: ORDER.amount },
    processed: true,
    processedAt: new Date(),
    createdAt: new Date(),
  });
  await db.insert(webhookEvents).values(webhookData);
  console.log(`  ✅ ${webhookData.length} webhook events (Recent Activity)`);

  // 7. Job logs (200 entries for Queue Status + Stats)
  const jobLogData = [];
  for (let i = 0; i < 200; i++) {
    const queueName = randomFrom(queueNames);
    const roll = Math.random();
    const status = roll < 0.90 ? 'completed' : roll < 0.95 ? 'active' : roll < 0.98 ? 'failed' : 'queued';
    const createdAt = daysAgo(randomBetween(0, 3));

    jobLogData.push({
      queueName,
      jobId: `${queueName}-${i}-${randomBetween(1000, 9999)}`,
      status,
      payload: { orderId: randomBetween(10200, 10250), type: queueName },
      result: status === 'completed' ? { success: true } : null,
      error: status === 'failed' ? randomFrom([
        'WooCommerce API timeout', 'Google Sheets rate limit 429',
        'WhatsApp delivery failed', 'SMTP connection refused',
      ]) : null,
      attempts: status === 'failed' ? randomBetween(1, 3) : 1,
      createdAt,
      completedAt: status === 'completed' ? new Date(createdAt.getTime() + randomBetween(1000, 60000)) : null,
    });
  }
  await db.insert(jobLogs).values(jobLogData);
  console.log(`  ✅ ${jobLogData.length} job logs (Queue Status + Stats cards)`);

  // Cron runs (30 entries)
  const cronData = [];
  for (let i = 0; i < 30; i++) {
    const startedAt = daysAgo(randomBetween(0, 4));
    const ok = Math.random() < 0.95;
    cronData.push({
      jobName: randomFrom(cronJobNames),
      startedAt,
      completedAt: ok ? new Date(startedAt.getTime() + randomBetween(2000, 30000)) : null,
      itemsProcessed: ok ? randomBetween(3, 40) : 0,
      error: ok ? null : 'API timeout',
    });
  }
  await db.insert(cronRuns).values(cronData);
  console.log(`  ✅ ${cronData.length} cron runs`);

  // Competitor snapshots (15 entries)
  const snapshots = [];
  for (const comp of compList) {
    for (let j = 0; j < 3; j++) {
      snapshots.push({
        competitorName: comp.name,
        url: comp.url,
        data: {
          productCount: randomBetween(500, 5000),
          priceRange: { min: randomBetween(2000, 10000), max: randomBetween(200000, 1500000) },
          promotions: [`${randomBetween(10, 30)}% off on diamond making charges`],
        },
        crawledAt: daysAgo(randomBetween(0, 10)),
      });
    }
  }
  await db.insert(competitorSnapshots).values(snapshots);
  console.log(`  ✅ ${snapshots.length} competitor snapshots`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DONE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║               DEMO READY                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('  DASHBOARD (localhost:3001):');
  console.log('    • Orders Processed  → ~180 completed jobs');
  console.log('    • Failed Today      → a few failures');
  console.log('    • Success Rate      → ~90-95%');
  console.log('    • Queue Status      → all 7 queues with job counts');
  console.log('    • Recent Activity   → 51 webhook events');
  console.log('');
  console.log('  GOOGLE SHEET:');
  console.log('    • Orders tab        → #10247 Aryan Budukh — "New"');
  console.log('    • Customers tab     → Aryan Budukh record');
  console.log('    • Competitors tab   → Tanishq, CaratLane, BlueStone');
  console.log('    • Creatives tab     → Arka Frost Terra Ring (Pending)');
  console.log('    • System Logs tab   → Setup log entry');
  console.log('');
  console.log('  ┌──────────────────────────────────────────────────────────┐');
  console.log('  │  WALKTHROUGH: Change status dropdown in Orders tab       │');
  console.log('  │                                                          │');
  console.log('  │  1. New → In Production     → Production tab row appears │');
  console.log('  │  2. In Production → QC      → QC tab: 6 items appear    │');
  console.log('  │  3. QC → Ready to Ship      → Email: QC passed          │');
  console.log('  │  4. Ready to Ship → Shipped → Email: Order shipped       │');
  console.log('  │  5. Shipped → Delivered     → Email: Delivered           │');
  console.log('  │                                                          │');
  console.log('  │  Wait 30 sec between each step for poller to detect.     │');
  console.log('  │  Backend must be running: npm run dev                     │');
  console.log('  └──────────────────────────────────────────────────────────┘');
  console.log('');

  await pool.end();
  process.exit(0);
}

setup().catch((err) => {
  console.error('Demo setup failed:', err);
  process.exit(1);
});
