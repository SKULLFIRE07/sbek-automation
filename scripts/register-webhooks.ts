/**
 * WooCommerce Webhook Registration Script
 *
 * Registers all required webhooks in your WooCommerce store.
 * Webhooks will POST to your n8n/backend webhook endpoints.
 *
 * Usage: npx tsx scripts/register-webhooks.ts
 */

import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import 'dotenv/config';

const WEBHOOK_BASE = process.env.WEBHOOK_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

const WEBHOOKS = [
  {
    name: 'SBEK Order Created',
    topic: 'order.created',
    delivery_url: `${WEBHOOK_BASE}/webhooks/woocommerce/order`,
  },
  {
    name: 'SBEK Order Updated',
    topic: 'order.updated',
    delivery_url: `${WEBHOOK_BASE}/webhooks/woocommerce/order`,
  },
  {
    name: 'SBEK Product Created',
    topic: 'product.created',
    delivery_url: `${WEBHOOK_BASE}/webhooks/woocommerce/product`,
  },
  {
    name: 'SBEK Product Updated',
    topic: 'product.updated',
    delivery_url: `${WEBHOOK_BASE}/webhooks/woocommerce/product`,
  },
];

async function main() {
  const url = process.env.WOO_URL;
  const consumerKey = process.env.WOO_CONSUMER_KEY;
  const consumerSecret = process.env.WOO_CONSUMER_SECRET;
  const secret = process.env.WOO_WEBHOOK_SECRET;

  if (!url || !consumerKey || !consumerSecret || !secret) {
    console.error('Missing WooCommerce credentials. Set WOO_URL, WOO_CONSUMER_KEY, WOO_CONSUMER_SECRET, WOO_WEBHOOK_SECRET');
    process.exit(1);
  }

  const api = new WooCommerceRestApi({
    url,
    consumerKey,
    consumerSecret,
    version: 'wc/v3',
  });

  // List existing webhooks
  console.log('Checking existing webhooks...');
  const { data: existing } = await api.get('webhooks');
  console.log(`Found ${existing.length} existing webhooks\n`);

  for (const hook of WEBHOOKS) {
    // Check if already registered
    const alreadyExists = existing.find(
      (e: { topic: string; delivery_url: string }) =>
        e.topic === hook.topic && e.delivery_url === hook.delivery_url
    );

    if (alreadyExists) {
      console.log(`✓ Already registered: ${hook.name} (${hook.topic})`);
      continue;
    }

    try {
      const { data } = await api.post('webhooks', {
        name: hook.name,
        topic: hook.topic,
        delivery_url: hook.delivery_url,
        secret,
        status: 'active',
      });
      console.log(`✓ Registered: ${hook.name} → ${hook.delivery_url} (ID: ${data.id})`);
    } catch (err) {
      console.error(`✗ Failed to register ${hook.name}:`, err);
    }
  }

  console.log('\n✅ Webhook registration complete!');
  console.log(`Delivery base URL: ${WEBHOOK_BASE}`);
}

main().catch((err) => {
  console.error('Registration failed:', err);
  process.exit(1);
});
