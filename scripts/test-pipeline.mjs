#!/usr/bin/env node
/**
 * SBEK Pipeline Test — sends test order + product webhooks
 *
 * Usage:
 *   node scripts/test-pipeline.mjs <BASE_URL> <WEBHOOK_SECRET>
 *
 * Example:
 *   node scripts/test-pipeline.mjs https://dashboard-production-1ce5.up.railway.app/api your_webhook_secret_here
 */

import { createHmac } from 'node:crypto';

const BASE_URL = process.argv[2];
const SECRET = process.argv[3];

if (!BASE_URL || !SECRET) {
  console.log('\nUsage: node scripts/test-pipeline.mjs <BASE_URL> <WEBHOOK_SECRET>\n');
  process.exit(1);
}

const url = BASE_URL.replace(/\/$/, '');

// ── Payloads ────────────────────────────────────────────────────────

const orderPayload = {
  id: 99901,
  status: 'processing',
  currency: 'INR',
  date_created: '2026-03-03T10:30:00',
  total: '45000.00',
  customer_id: 42,
  customer_note: 'Please engrave Forever in cursive',
  payment_method: 'razorpay',
  payment_method_title: 'Razorpay',
  billing: {
    first_name: 'Test',
    last_name: 'Customer',
    email: 'test@example.com',
    phone: '9876543210',
    address_1: '123 MG Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    postcode: '400001',
    country: 'IN',
  },
  shipping: {
    first_name: 'Test',
    last_name: 'Customer',
    address_1: '123 MG Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    postcode: '400001',
    country: 'IN',
  },
  line_items: [
    {
      id: 101,
      name: 'Celestial Gold Ring',
      product_id: 501,
      variation_id: 0,
      quantity: 1,
      total: '45000.00',
      sku: 'SBEK-TEST-001',
      meta_data: [
        { id: 1, key: 'pa_ring-size', value: '7' },
        { id: 2, key: 'pa_metal-type', value: '18K Yellow Gold' },
        { id: 3, key: 'pa_stone-type', value: 'Diamond' },
        { id: 4, key: '_engraving_text', value: 'Forever' },
      ],
      image: {
        id: 201,
        src: 'https://sb-ek.com/wp-content/uploads/celestial-ring.jpg',
      },
    },
  ],
  meta_data: [],
};

const orderUpdatePayload = {
  id: 99901,
  status: 'completed',
  currency: 'INR',
  date_created: '2026-03-03T10:30:00',
  total: '45000.00',
  customer_id: 42,
  billing: {
    first_name: 'Test',
    last_name: 'Customer',
    email: 'test@example.com',
    phone: '9876543210',
  },
  line_items: [
    {
      id: 101,
      name: 'Celestial Gold Ring',
      product_id: 501,
      quantity: 1,
      total: '45000.00',
      sku: 'SBEK-TEST-001',
      meta_data: [],
    },
  ],
  meta_data: [],
};

const productPayload = {
  id: 99801,
  name: 'Royal Diamond Necklace',
  slug: 'royal-diamond-necklace',
  type: 'simple',
  status: 'publish',
  description:
    '<p>A breathtaking Royal Diamond Necklace handcrafted in 22K gold with VS1 clarity diamonds. This exquisite piece features a cascading design with 24 brilliant-cut diamonds set in a traditional Indian motif. Perfect for weddings, anniversaries, and special occasions.</p>',
  short_description:
    'Handcrafted 22K gold necklace with 24 VS1 brilliant-cut diamonds in traditional Indian cascading design.',
  sku: 'SBEK-TEST-NK-001',
  price: '185000',
  regular_price: '185000',
  sale_price: '',
  categories: [
    { id: 15, name: 'Necklaces', slug: 'necklaces' },
    { id: 20, name: 'Diamond', slug: 'diamond' },
    { id: 25, name: 'Wedding', slug: 'wedding' },
  ],
  images: [
    {
      id: 301,
      src: 'https://sb-ek.com/wp-content/uploads/royal-diamond-necklace.jpg',
      name: 'Royal Diamond Necklace',
      alt: 'SBEK Royal Diamond Necklace 22K Gold',
    },
  ],
  attributes: [
    { id: 1, name: 'Metal', slug: 'pa_metal', visible: true, options: ['22K Yellow Gold'] },
    { id: 2, name: 'Stone', slug: 'pa_stone', visible: true, options: ['VS1 Diamond'] },
  ],
  meta_data: [{ id: 100, key: '_estimated_production_days', value: '21' }],
};

// ── Helper: send webhook with correct HMAC ──────────────────────────

async function sendWebhook(endpoint, topic, payload, label) {
  // Create exact JSON buffer — this is what the server will receive
  const bodyStr = JSON.stringify(payload);
  const bodyBuf = Buffer.from(bodyStr, 'utf-8');

  // Compute HMAC-SHA256 signature on the exact bytes
  const sig = createHmac('sha256', SECRET).update(bodyBuf).digest('base64');

  console.log(`── ${label} ──`);
  console.log(`   Endpoint: ${url}${endpoint}`);
  console.log(`   Topic:    ${topic}`);
  console.log(`   Body:     ${bodyBuf.length} bytes`);
  console.log(`   Sig:      ${sig.slice(0, 24)}...`);
  console.log('');

  try {
    const res = await fetch(`${url}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Topic': topic,
        'X-WC-Webhook-ID': `test-${Date.now()}`,
        'X-WC-Webhook-Signature': sig,
      },
      body: bodyStr,
    });

    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }

    if (res.ok) {
      console.log(`   Status: ${res.status} OK`);
    } else {
      console.log(`   Status: ${res.status} FAIL`);
    }
    console.log(`   Response:`, parsed);
    console.log('');
    return res.ok;
  } catch (err) {
    console.log(`   ERROR: ${err.message}`);
    console.log('');
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('==========================================');
  console.log('  SBEK Pipeline Test');
  console.log('==========================================');
  console.log(`  URL:    ${url}`);
  console.log(`  Secret: ${SECRET.slice(0, 4)}****`);
  console.log('==========================================');
  console.log('');

  // Health check
  console.log('== TEST 0: Health Check ==');
  try {
    const h = await fetch(`${url}/health`);
    const hBody = await h.json();
    console.log(`   Status: ${h.status}`);
    console.log(`   Response:`, hBody);
    if (!h.ok) { console.log('   FAILED — backend not reachable'); process.exit(1); }
    console.log('   Backend is UP!');
  } catch (err) {
    console.log(`   FAILED: ${err.message}`);
    process.exit(1);
  }
  console.log('');

  // Test 1: New Order
  console.log('== TEST 1: New Order (order.created) ==');
  console.log('   Triggers: Sheets (Orders + Customers), Email, WhatsApp');
  console.log('');
  const t1 = await sendWebhook(
    '/webhooks/woocommerce/order',
    'order.created',
    orderPayload,
    'Order #99901 — Celestial Gold Ring — INR 45,000'
  );

  // Test 2: Order Updated
  console.log('== TEST 2: Order Updated (order.updated → completed) ==');
  console.log('   Triggers: Sheets status update to "Delivered"');
  console.log('');
  const t2 = await sendWebhook(
    '/webhooks/woocommerce/order',
    'order.updated',
    orderUpdatePayload,
    'Order #99901 — Status → completed'
  );

  // Test 3: New Product
  console.log('== TEST 3: New Product (product.created) ==');
  console.log('   Triggers: 6 content jobs + 5 creative image variants');
  console.log('');
  const t3 = await sendWebhook(
    '/webhooks/woocommerce/product',
    'product.created',
    productPayload,
    'Product #99801 — Royal Diamond Necklace — INR 1,85,000'
  );

  // Queue status
  console.log('== TEST 4: Queue Status ==');
  try {
    const s = await fetch(`${url}/dashboard/stats`);
    const sBody = await s.json();
    console.log('   Active:', sBody.totalActive, '| Waiting:', sBody.totalWaiting, '| Completed:', sBody.totalCompleted, '| Failed:', sBody.totalFailed);
  } catch { console.log('   Could not fetch queue stats'); }
  console.log('');

  // Summary
  console.log('==========================================');
  console.log('  RESULTS');
  console.log('==========================================');
  console.log(`  Health:    OK`);
  console.log(`  Order:     ${t1 ? 'OK' : 'FAILED'}`);
  console.log(`  Update:    ${t2 ? 'OK' : 'FAILED'}`);
  console.log(`  Product:   ${t3 ? 'OK' : 'FAILED'}`);
  console.log('');

  if (t1 && t2 && t3) {
    console.log('  ALL PASSED! Check your Google Sheet + Dashboard Queues.');
  } else {
    console.log('  Some tests failed. Check the responses above.');
    console.log('  If signature errors: make sure WEBHOOK_SECRET matches your Railway env.');
  }
  console.log('');
}

main().catch(console.error);
