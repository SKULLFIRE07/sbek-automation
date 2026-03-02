import 'dotenv/config';
import WooCommerceRestApiPkg from '@woocommerce/woocommerce-rest-api';
const WooCommerceRestApi = (WooCommerceRestApiPkg as any).default || WooCommerceRestApiPkg;
import { Queue } from 'bullmq';
import type { CreativeGenerationPayload } from '../src/queues/types.js';

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

const queue = new Queue<CreativeGenerationPayload>('creative-generation', { connection });

const api = new WooCommerceRestApi({
  url: process.env.WOO_URL || 'https://sb-ek.com',
  consumerKey: process.env.WOO_CONSUMER_KEY,
  consumerSecret: process.env.WOO_CONSUMER_SECRET,
  version: 'wc/v3',
  queryStringAuth: true,
  timeout: 30_000,
});

const ALL_VARIANTS: CreativeGenerationPayload['variants'] = [
  'white_bg',
  'lifestyle',
  'festive',
  'minimal_text',
  'story_format',
];

// ---------------------------------------------------------------------------
// How many products to process (default: 1 for testing)
// Usage:  npx tsx scripts/generate-test-creatives.ts        → 1 product
//         npx tsx scripts/generate-test-creatives.ts 5      → 5 products
//         npx tsx scripts/generate-test-creatives.ts all    → all products
// ---------------------------------------------------------------------------

const arg = process.argv[2];
const limit = arg === 'all' ? 100 : Number(arg) || 1;

async function main() {
  console.log(`\n=== SBEK Creative Generation ===\n`);
  console.log(`Fetching products from WooCommerce (limit: ${limit})...\n`);

  const response = await api.get('products', { per_page: limit, status: 'publish' });
  const products = response.data;

  console.log(`Found ${products.length} product(s). Enqueuing creative jobs...\n`);

  for (const product of products) {
    const payload: CreativeGenerationPayload = {
      productId: product.id,
      productName: product.name,
      productDescription: product.short_description?.replace(/<[^>]*>/g, '') || product.name,
      productImageUrl: product.images?.[0]?.src || '',
      category: product.categories?.[0]?.name || 'Jewelry',
      variants: ALL_VARIANTS,
    };

    await queue.add(`creative-${product.id}`, payload, {
      jobId: `creative-${product.id}-${Date.now()}`,
    });

    console.log(`  ✓ Enqueued: #${product.id} — ${product.name} (5 variants)`);
  }

  console.log(`\n=== ${products.length} job(s) enqueued ===`);
  console.log(`Total images to generate: ${products.length * 5}`);
  console.log(`\nThe backend worker will now process these jobs.`);
  console.log(`Watch progress at: http://localhost:3001/queues\n`);

  await queue.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
