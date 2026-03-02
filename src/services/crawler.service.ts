import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { settings } from './settings.service.js';

// ── Interfaces ──────────────────────────────────────────────────────

export interface CrawlResult {
  url: string;
  title: string;
  products: Array<{
    name: string;
    price: number;
    currency: string;
    category?: string;
    url?: string;
  }>;
  meta: {
    description?: string;
    keywords?: string[];
    ogImage?: string;
  };
  links: string[];
  crawledAt: string;
  snapshotId?: number;
}

// ── Service ─────────────────────────────────────────────────────────

class CrawlerService {
  /** Resolve the crawler base URL from settings (with env fallback) */
  private async getBaseUrl(): Promise<string> {
    return (await settings.get('CRAWLER_BASE_URL')) ?? env.CRAWLER_BASE_URL;
  }

  // ── Public methods ───────────────────────────────────────────────

  /**
   * Submit a URL to the crawler microservice for analysis.
   * Optionally pass previous crawl data for delta comparison.
   * Crawling can be slow, so we use a 60-second timeout.
   */
  async analyzeSite(url: string, previousCrawl?: Record<string, unknown>): Promise<CrawlResult> {
    try {
      const body: Record<string, unknown> = { url };
      if (previousCrawl) {
        body.previousCrawl = previousCrawl;
      }
      const data = await this.request('POST', '/crawl', body);
      logger.info({ url, snapshotId: data.snapshotId }, 'Site crawl completed');
      return data as CrawlResult;
    } catch (error) {
      logger.error({ error, url }, 'Failed to analyze site via crawler');
      throw error;
    }
  }

  /**
   * Health check for the crawler microservice.
   */
  async getHealth(): Promise<{ status: string }> {
    try {
      const data = await this.request('GET', '/health');
      return data as { status: string };
    } catch (error) {
      logger.error({ error }, 'Crawler health check failed');
      throw error;
    }
  }

  /**
   * List all previously generated crawl reports.
   */
  async listReports(): Promise<any[]> {
    try {
      const data = await this.request('GET', '/reports');
      return Array.isArray(data) ? data : data.reports ?? [];
    } catch (error) {
      logger.error({ error }, 'Failed to list crawler reports');
      throw error;
    }
  }

  // ── Private helper ───────────────────────────────────────────────

  /**
   * Low-level HTTP request to the crawler microservice.
   * Uses a 60-second timeout because crawling is inherently slow.
   */
  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error(
          { status: response.status, errorBody, method, path },
          'Crawler API error response',
        );
        throw new Error(
          `Crawler API responded with ${response.status}: ${errorBody}`,
        );
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ── Singleton Export ────────────────────────────────────────────────────────

export const crawler = new CrawlerService();
