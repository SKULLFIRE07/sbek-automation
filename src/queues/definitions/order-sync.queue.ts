import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { db } from '../../config/database.js';
import { webhookEvents } from '../../db/schema.js';
import type { OrderSyncPayload } from '../types.js';
import { processOrderSync } from '../../workflows/order-processing.workflow.js';
import { logJobActive, logJobCompleted, logJobFailed } from '../job-logger.js';

/** Parse REDIS_URL for BullMQ worker connection */
function redisOpts() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

export const orderSyncWorker = new Worker<OrderSyncPayload>(
  'order-sync',
  async (job: Job<OrderSyncPayload>) => {
    logJobActive('order-sync', job);
    logger.info({ jobId: job.id, orderId: job.data.orderId, event: job.data.event }, 'Processing order sync');
    return processOrderSync(job.data);
  },
  {
    connection: redisOpts(),
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 60_000, // max 10 jobs/minute — respect API rate limits
    },
  }
);

orderSyncWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, orderId: job.data.orderId }, 'Order sync completed');
  logJobCompleted('order-sync', job);
  // Mark the specific webhook event as processed in dashboard activity feed
  if (job.data.webhookEventId) {
    db.update(webhookEvents)
      .set({ processed: true, processedAt: new Date() })
      .where(eq(webhookEvents.id, job.data.webhookEventId))
      .catch(() => {});
  }
});

orderSyncWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, orderId: job?.data.orderId, err: err.message }, 'Order sync failed');
  logJobFailed('order-sync', job, err);
});
