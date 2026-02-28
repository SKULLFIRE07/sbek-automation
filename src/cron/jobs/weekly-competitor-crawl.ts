import { logger } from '../../config/logger.js';
import { competitorCrawl } from '../../queues/registry.js';

/**
 * Weekly cron: enqueue competitor crawl jobs.
 * Competitor URLs are configured here (will be moved to Sheets config in future).
 */

// Default competitor list — these will be managed via Google Sheets "Competitors" tab
const DEFAULT_COMPETITORS = [
  { name: 'Competitor A', url: 'https://example-competitor-a.com' },
  { name: 'Competitor B', url: 'https://example-competitor-b.com' },
];

export async function runWeeklyCompetitorCrawl(): Promise<void> {
  let enqueued = 0;

  for (const competitor of DEFAULT_COMPETITORS) {
    await competitorCrawl.add(`crawl-${competitor.name}`, {
      competitorName: competitor.name,
      url: competitor.url,
    });
    enqueued++;
  }

  logger.info({ enqueued }, 'Weekly competitor crawl jobs enqueued');
}
