import { Worker, type Job } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { ReviewRequestPayload } from '../types.js';
import { sendReviewRequest } from '../../workflows/review-collection.workflow.js';

function redisOpts() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

/**
 * Review Request Worker — processes delayed review request jobs.
 * Jobs are created with a 5-day delay when an order is marked as delivered.
 */
export const reviewRequestWorker = new Worker<ReviewRequestPayload>(
  'review-request',
  async (job: Job<ReviewRequestPayload>) => {
    logger.info({ jobId: job.id, orderId: job.data.orderId }, 'Processing review request');
    return sendReviewRequest(job.data);
  },
  {
    connection: redisOpts(),
    concurrency: 2,
  }
);

reviewRequestWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, orderId: job.data.orderId }, 'Review request completed');
});

reviewRequestWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Review request failed');
});
