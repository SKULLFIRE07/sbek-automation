import { logger } from '../../config/logger.js';
import { woocommerce } from '../../services/woocommerce.service.js';
import { contentGeneration } from '../../queues/registry.js';

/**
 * Weekly cron: generate SEO content for products that don't have it yet.
 * Enqueues content generation jobs for each product.
 */
export async function runWeeklyContentGeneration(): Promise<void> {
  let enqueued = 0;

  try {
    const products = await woocommerce.listProducts({ per_page: 100, status: 'publish' });

    if (!products || products.length === 0) {
      logger.info('No published products found for content generation');
      return;
    }

    for (const product of products) {
      // Generate SEO meta
      await contentGeneration.add(`seo-${product.id}`, {
        productId: product.id,
        productName: product.name,
        type: 'seo_meta',
      });

      // Generate FAQs
      await contentGeneration.add(`faq-${product.id}`, {
        productId: product.id,
        productName: product.name,
        type: 'faq',
      });

      enqueued += 2;
    }
  } catch (err) {
    logger.error({ err }, 'Weekly content generation failed');
    throw err;
  }

  logger.info({ enqueued }, 'Weekly content generation jobs enqueued');
}
