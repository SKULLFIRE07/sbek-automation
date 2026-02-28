import { Worker, type Job } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { ContentGenerationPayload } from '../types.js';
import { processContentGeneration } from '../../workflows/content-pipeline.workflow.js';

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
 * Content Generation Worker — processes SEO meta, FAQ, AEO knowledge-base,
 * and comparison article jobs via OpenAI.
 *
 * Concurrency is intentionally low (2) to avoid hammering the OpenAI API
 * and to stay within rate limits.
 */
export const contentGenerationWorker = new Worker<ContentGenerationPayload>(
  'content-generation',
  async (job: Job<ContentGenerationPayload>) => {
    logger.info(
      { jobId: job.id, productId: job.data.productId, type: job.data.type },
      'Processing content generation',
    );
    return processContentGeneration(job.data);
  },
  {
    connection: redisOpts(),
    concurrency: 2,
  },
);

contentGenerationWorker.on('completed', (job) => {
  logger.info(
    { jobId: job.id, productId: job.data.productId, type: job.data.type },
    'Content generation completed',
  );
});

contentGenerationWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, productId: job?.data.productId, type: job?.data.type, err: err.message },
    'Content generation failed',
  );
});
