import 'dotenv/config';
import { Queue } from 'bullmq';
import type { OrderSyncPayload } from '../src/queues/types.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
const url = new URL(REDIS_URL);

const connection = {
  host: url.hostname,
  port: Number(url.port) || 6379,
  password: url.password || undefined,
  maxRetriesPerRequest: null as null,
};

const orderSyncQueue = new Queue<OrderSyncPayload>('order-sync', { connection });

// ---------------------------------------------------------------------------
// Fake WooCommerce order (matches real WooCommerce webhook payload format)
// ---------------------------------------------------------------------------

const fakeOrder = {
  id: 99999,
  status: 'processing',
  currency: 'INR',
  total: '12500.00',
  date_created: new Date().toISOString(),
  date_modified: new Date().toISOString(),
  payment_method: 'razorpay',
  payment_method_title: 'Razorpay',
  customer_id: 1,
  billing: {
    first_name: 'Aryan',
    last_name: 'Budukh',
    email: process.env.SMTP_USER || 'aryansbudukh@gmail.com',
    phone: '+919999999999',
    address_1: '123 Test Street',
    address_2: '',
    city: 'Mumbai',
    state: 'MH',
    postcode: '400001',
    country: 'IN',
  },
  shipping: {
    first_name: 'Aryan',
    last_name: 'Budukh',
    address_1: '123 Test Street',
    address_2: '',
    city: 'Mumbai',
    state: 'MH',
    postcode: '400001',
    country: 'IN',
  },
  line_items: [
    {
      id: 1,
      name: 'Arka Frost Terra',
      product_id: 23504,
      variation_id: 0,
      quantity: 1,
      total: '12500.00',
      sku: 'SBEK-AFT-001',
      meta_data: [
        { id: 1, key: '_ring_size', value: '16' },
        { id: 2, key: '_metal_type', value: '925 Sterling Silver' },
        { id: 3, key: '_stone_type', value: 'Blue Topaz' },
      ],
      attributes: [],
    },
  ],
  customer_note: 'Test order from SBEK automation pipeline',
  meta_data: [],
};

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n=== SBEK Order Pipeline Test ===\n');
  console.log('This will enqueue a test order through the full pipeline:');
  console.log('  Order Sync Queue -> Google Sheets + Email Notification\n');

  const payload: OrderSyncPayload = {
    orderId: fakeOrder.id,
    event: 'order.created',
    rawPayload: fakeOrder as unknown as Record<string, unknown>,
  };

  await orderSyncQueue.add(`order-${fakeOrder.id}`, payload, {
    jobId: `test-order-${fakeOrder.id}-${Date.now()}`,
  });

  console.log('  Enqueued test order #99999 (Arka Frost Terra, Rs 12,500)');
  console.log('  Customer: Aryan Budukh');
  console.log('  Email: ' + fakeOrder.billing.email);
  console.log('\n=== What to watch ===');
  console.log('  1. Dashboard Queues  -> order-sync job processing');
  console.log('  2. Dashboard Activity -> job completion event');
  console.log('  3. Google Sheet      -> new row in Orders tab');
  console.log('  4. Gmail inbox       -> order confirmation email');
  console.log('  5. Backend terminal  -> processing logs\n');

  await orderSyncQueue.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
