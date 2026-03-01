import { logger } from '../../config/logger.js';
import { woocommerce } from '../../services/woocommerce.service.js';
import { contentGeneration, creativeGeneration } from '../../queues/registry.js';

/**
 * Weekly cron: generate all content types for published products.
 * Enqueues SEO meta, FAQ, AEO KB, comparison, schema injection,
 * internal linking, and creative generation jobs for each product.
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
      const contentTypes = [
        'seo_meta',
        'faq',
        'aeo_kb',
        'comparison',
        'schema_inject',
        'internal_links',
      ] as const;

      for (const type of contentTypes) {
        await contentGeneration.add(`${type}-${product.id}`, {
          productId: product.id,
          productName: product.name,
          type,
        });
        enqueued++;
      }

      // Also enqueue creative generation for products
      const description = (product.short_description || product.description || '').replace(/<[^>]*>/g, '');
      const category = product.categories?.[0]?.name || 'Jewelry';
      const imageUrl = product.images?.[0]?.src || '';

      await creativeGeneration.add(`creative-weekly-${product.id}`, {
        productId: product.id,
        productName: product.name,
        productDescription: description.slice(0, 500),
        productImageUrl: imageUrl,
        category,
        variants: ['white_bg', 'lifestyle', 'festive', 'minimal_text', 'story_format'],
      });
      enqueued++;
    }
  } catch (err) {
    logger.error({ err }, 'Weekly content generation failed');
    throw err;
  }

  logger.info({ enqueued }, 'Weekly content + creative generation jobs enqueued');
}
