import { logger } from '../../config/logger.js';
import { woocommerce } from '../../services/woocommerce.service.js';
import { orderSync } from '../../queues/registry.js';

/**
 * Daily cron: full reconciliation sync.
 * Pulls recent orders from WooCommerce and enqueues sync jobs
 * to ensure Sheets stays in sync even if webhooks were missed.
 */
export async function runDailySheetsSync(): Promise<void> {
  let page = 1;
  let enqueued = 0;

  // Sync orders from the last 3 days to catch any missed webhooks
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  try {
    while (true) {
      const orders = await woocommerce.listOrders({
        per_page: 50,
        page,
      });

      if (!orders || orders.length === 0) break;

      for (const order of orders) {
        const orderDate = new Date(order.date_created);
        if (orderDate < threeDaysAgo) continue;

        await orderSync.add(`sync-${order.id}`, {
          orderId: order.id,
          event: 'order.updated',
          rawPayload: order as unknown as Record<string, unknown>,
        }, { jobId: `daily-sync-${order.id}` });
        enqueued++;
      }

      if (orders.length < 50) break;
      page++;
    }
  } catch (err) {
    logger.error({ err }, 'Daily sheets sync failed during fetch');
    throw err;
  }

  logger.info({ enqueued, pages: page }, 'Daily sheets sync completed');
}
