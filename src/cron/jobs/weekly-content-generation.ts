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
    // Paginate through ALL published products (not just first 100)
    type ProductType = Awaited<ReturnType<typeof woocommerce.listProducts>>[number];
    const allProducts: ProductType[] = [];
    let page = 1;
    const perPage = 100;

    while (page <= 20) { // Safety cap at 2000 products
      const batch = await woocommerce.listProducts({ per_page: perPage, status: 'publish', page });
      if (!batch || batch.length === 0) break;
      allProducts.push(...batch);
      if (batch.length < perPage) break; // Last page
      page++;
    }

    if (allProducts.length === 0) {
      logger.info('No published products found for content generation');
      return;
    }

    logger.info({ totalProducts: allProducts.length, pages: page }, 'Fetched all products for content generation');

    for (const product of allProducts) {
      const contentTypes = [
        'seo_meta',
        'faq',
        'aeo_kb',
        'comparison',
        'schema_inject',
        'internal_links',
      ] as const;

      for (const type of contentTypes) {
        try {
          await contentGeneration.add(`${type}-${product.id}`, {
            productId: product.id,
            productName: product.name,
            type,
          }, { jobId: `weekly-${type}-${product.id}` });
          enqueued++;
        } catch (err) {
          logger.error({ err, productId: product.id, type }, 'Failed to enqueue content generation job');
        }
      }

      // Also enqueue creative generation for products
      try {
        const description = (product.short_description || product.description || '').replace(/<[^>]*>/g, '');
        const category = product.categories?.[0]?.name || 'Jewelry';
        const imageUrl = product.images?.[0]?.src || '';

        await creativeGeneration.add(`creative-weekly-${product.id}`, {
          productId: product.id,
          productName: product.name,
          productDescription: description.slice(0, 500),
          productImageUrl: imageUrl,
          category,
          variants: ['hero_shot', 'flat_lay', 'occasion', 'ad_ready', 'story_cinematic'],
        }, { jobId: `weekly-creative-${product.id}` });
        enqueued++;
      } catch (err) {
        logger.error({ err, productId: product.id }, 'Failed to enqueue creative generation job');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Weekly content generation failed');
    throw err;
  }

  logger.info({ enqueued }, 'Weekly content + creative generation jobs enqueued');
}
