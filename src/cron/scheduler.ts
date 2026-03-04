import cron from 'node-cron';
import { logger } from '../config/logger.js';
import { db } from '../config/database.js';
import { cronRuns } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { runDailyReviewRequests } from './jobs/daily-review-requests.js';
import { runWeeklyCompetitorCrawl } from './jobs/weekly-competitor-crawl.js';
import { runDailySheetsSync } from './jobs/daily-sheets-sync.js';
import { runWeeklyContentGeneration } from './jobs/weekly-content-generation.js';
import { runStatusPoller } from './jobs/status-poller.js';

const IST = { timezone: 'Asia/Kolkata' };

/**
 * Run a cron job and log it to the cronRuns table for the dashboard System page.
 */
async function trackCronRun(jobName: string, fn: () => Promise<number | void>): Promise<void> {
  const [row] = await db.insert(cronRuns).values({
    jobName,
    startedAt: new Date(),
  }).returning({ id: cronRuns.id });

  try {
    const result = await fn();
    const itemsProcessed = typeof result === 'number' ? result : 0;
    await db.update(cronRuns)
      .set({ completedAt: new Date(), itemsProcessed })
      .where(eq(cronRuns.id, row.id));
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await db.update(cronRuns)
      .set({ completedAt: new Date(), error: errorMsg })
      .where(eq(cronRuns.id, row.id))
      .catch(() => {});
    throw err;
  }
}

/**
 * Initialize all cron jobs. Call once at app startup.
 */
export function initScheduler(): void {
  logger.info('Initializing cron scheduler (timezone: Asia/Kolkata)');

  // Daily at 6:00 AM IST — check for orders to send review requests
  cron.schedule('0 6 * * *', async () => {
    logger.info('Cron: daily review requests');
    try {
      await trackCronRun('daily-review-requests', runDailyReviewRequests);
    } catch (err) {
      logger.error({ err }, 'Cron: daily review requests failed');
    }
  }, IST);

  // Daily at 2:00 AM IST — full reconciliation sync with WooCommerce
  cron.schedule('0 2 * * *', async () => {
    logger.info('Cron: daily sheets sync');
    try {
      await trackCronRun('daily-sheets-sync', runDailySheetsSync);
    } catch (err) {
      logger.error({ err }, 'Cron: daily sheets sync failed');
    }
  }, IST);

  // Weekly Sunday 10:00 PM IST — competitor monitoring crawl
  cron.schedule('0 22 * * 0', async () => {
    logger.info('Cron: weekly competitor crawl');
    try {
      await trackCronRun('weekly-competitor-crawl', runWeeklyCompetitorCrawl);
    } catch (err) {
      logger.error({ err }, 'Cron: weekly competitor crawl failed');
    }
  }, IST);

  // Weekly Monday 9:00 AM IST — batch SEO/AEO content for new products
  cron.schedule('0 9 * * 1', async () => {
    logger.info('Cron: weekly content generation');
    try {
      await trackCronRun('weekly-content-generation', runWeeklyContentGeneration);
    } catch (err) {
      logger.error({ err }, 'Cron: weekly content generation failed');
    }
  }, IST);

  // Every 30 seconds — poll Orders sheet for manual status changes
  // (not tracked in cronRuns — too frequent, would bloat the table)
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await runStatusPoller();
    } catch (err) {
      logger.error({ err }, 'Cron: status poller failed');
    }
  }, IST);

  logger.info('Cron scheduler initialized with 5 jobs');
}
