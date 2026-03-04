import { logger } from '../../config/logger.js';
import { sheets } from '../../services/googlesheets.service.js';
import { reviewRequest } from '../../queues/registry.js';
import { isOlderThanDays } from '../../utils/date.js';

/**
 * Daily cron: find delivered orders where delivery was 5+ days ago
 * and enqueue review request jobs for those that haven't been sent yet.
 */
export async function runDailyReviewRequests(): Promise<void> {
  const deliveredOrders = await sheets.getOrdersByStatus('Delivered');

  if (!deliveredOrders || deliveredOrders.length === 0) {
    logger.info('No delivered orders found for review requests');
    return;
  }

  let enqueued = 0;

  for (const row of deliveredOrders) {
    const lastUpdated = row['Last Updated'];
    const notes = row['Notes'] || '';

    // Skip if review already sent
    if (notes.includes('Review Sent')) continue;

    // Check if delivered more than 5 days ago
    if (lastUpdated && isOlderThanDays(new Date(lastUpdated), 5)) {
      const orderId = Number(row['Order ID']);
      const customerName = row['Customer Name'] || '';
      const email = row['Email'] || '';
      const phone = row['Phone'] || '';
      const productName = row['Product'] || '';

      await reviewRequest.add(`daily-review-${orderId}`, {
        orderId,
        customerName,
        customerEmail: email,
        customerPhone: phone,
        productName,
        deliveredDate: lastUpdated,
      }, { jobId: `daily-review-${orderId}` });

      // Mark as review sent to prevent duplicates
      await sheets.updateOrder(String(orderId), {
        'Notes': `${notes} | Review Sent ${new Date().toISOString().split('T')[0]}`.trim(),
      });

      enqueued++;
    }
  }

  logger.info({ enqueued }, 'Daily review requests enqueued');
}
