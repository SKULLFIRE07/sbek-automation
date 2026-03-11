import { Worker, type Job } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { CompetitorCrawlPayload } from '../types.js';
import { processCompetitorCrawl } from '../../workflows/competitor-monitoring.workflow.js';
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
 * Competitor Crawl Worker — crawls competitor websites and analyses changes.
 * Concurrency: 1 (crawling is slow and resource-heavy).
 * Job timeout: 5 minutes (crawl polling + AI analysis + email).
 */
export const competitorCrawlWorker = new Worker<CompetitorCrawlPayload>(
  'competitor-crawl',
  async (job: Job<CompetitorCrawlPayload>) => {
    logJobActive('competitor-crawl', job);
    logger.info(
      { jobId: job.id, competitor: job.data.competitorName, url: job.data.url },
      'Processing competitor crawl',
    );
    return processCompetitorCrawl(job.data);
  },
  {
    connection: redisOpts(),
    concurrency: 1,
    lockDuration: 300_000,
  },
);

competitorCrawlWorker.on('completed', (job) => {
  logger.info(
    { jobId: job.id, competitor: job.data.competitorName },
    'Competitor crawl completed',
  );
  logJobCompleted('competitor-crawl', job);
});

competitorCrawlWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, competitor: job?.data.competitorName, err: err.message },
    'Competitor crawl failed',
  );
  logJobFailed('competitor-crawl', job, err);
});
