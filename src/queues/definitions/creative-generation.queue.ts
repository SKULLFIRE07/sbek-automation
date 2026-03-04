import { Worker, type Job } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { CreativeGenerationPayload } from '../types.js';
import { processCreativeGeneration } from '../../workflows/creative-pipeline.workflow.js';
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

/**
 * Creative Generation Worker — generates ad creatives via DALL-E.
 * Concurrency: 1 (DALL-E is expensive and slow).
 */
export const creativeGenerationWorker = new Worker<CreativeGenerationPayload>(
  'creative-generation',
  async (job: Job<CreativeGenerationPayload>) => {
    logJobActive('creative-generation', job);
    logger.info(
      {
        jobId: job.id,
        productId: job.data.productId,
        productName: job.data.productName,
        variants: job.data.variants,
      },
      'Processing creative generation',
    );
    return processCreativeGeneration(job.data);
  },
  {
    connection: redisOpts(),
    concurrency: 1,
  },
);

creativeGenerationWorker.on('completed', (job) => {
  logger.info(
    { jobId: job.id, productId: job.data.productId },
    'Creative generation completed',
  );
  logJobCompleted('creative-generation', job);
});

creativeGenerationWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, productId: job?.data.productId, err: err.message },
    'Creative generation failed',
  );
  logJobFailed('creative-generation', job, err);
});
