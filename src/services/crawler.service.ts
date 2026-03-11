import { logger } from '../config/logger.js';
import { settings } from './settings.service.js';
import { env } from '../config/env.js';

// ── Interfaces (unchanged — used by competitor-report, workflows, etc.) ──

export interface CrawlProduct {
  name: string;
  price: number;
  currency: string;
  category?: string;
  url?: string;
}

export type CrawlDifficulty = 'easy' | 'hard' | 'blocked';

export interface CrawlResult {
  url: string;
  title: string;
  products: CrawlProduct[];
  meta: {
    description?: string;
    keywords?: string[];
    ogImage?: string;
    ogTitle?: string;
    canonical?: string;
  };
  techSeo: {
    hasSchema: boolean;
    schemaTypes: string[];
    h1Tags: string[];
    h2Tags: string[];
    hasOpenGraph: boolean;
    hasSitemap: boolean;
    robotsTxt: string;
  };
  links: string[];
  pageCount: number;
  crawledAt: string;
  crawlDifficulty: CrawlDifficulty;
}

// ── Crawl360 API types ──────────────────────────────────────────────

interface Crawl360PageSchema {
  type?: string;
  properties?: Record<string, unknown>;
  // Also support raw JSON-LD format
  '@type'?: string;
  '@graph'?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface Crawl360Page {
  success: boolean;
  url: string;
  final_url?: string;
  status_code?: number;
  load_time_ms?: number;
  fetcher_used?: string;
  cached?: boolean;
  metadata?: {
    title?: string;
    description?: string;
    canonical?: string;
    opengraph?: Record<string, string>;
    twitter_card?: Record<string, string>;
    schemas?: Crawl360PageSchema[];
  };
  content?: {
    text?: string;
    markdown?: string;
    raw_html?: string;
    word_count?: number;
    html_size_bytes?: number;
  };
  headings?: {
    h1?: string[];
    h2?: string[];
    h3?: string[];
    h4?: string[];
    h5?: string[];
    h6?: string[];
  };
  links?: Array<{
    href: string;
    text?: string;
    is_internal?: boolean;
    is_nofollow?: boolean;
  }>;
  images?: Array<{
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  }>;
}

interface CrawlJobStartResponse {
  job_id: string;
  status: string;
  poll_url: string;
  estimated_time_seconds?: number;
}

interface CrawlJobPollResponse {
  job_id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: {
    completed: number;
    total: number;
    current_url?: string;
  };
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  result?: {
    job_id: string;
    status: string;
    domain: string;
    pages_crawled: number;
    pages: Crawl360Page[];
  };
  error?: string;
}

// ── Service ─────────────────────────────────────────────────────────

class CrawlerService {
  private readonly baseUrl = 'https://crawl.360labs.ai';

  /** Resolve API key from DB settings or env */
  private async getApiKey(): Promise<string | undefined> {
    return (await settings.get('CRAWL360_API_KEY')) ?? env.CRAWL360_API_KEY;
  }

  /** Health check */
  async getHealth(): Promise<{ status: string }> {
    const key = await this.getApiKey();
    return { status: key ? 'ok' : 'no_api_key' };
  }

  /** No-op — no browser to close */
  async close(): Promise<void> {}

  /**
   * Crawl a competitor site using Crawl360 /v1/crawl API.
   * Submits an async crawl job, polls until complete, then extracts data.
   */
  async analyzeSite(url: string, _previousCrawl?: Record<string, unknown>): Promise<CrawlResult> {
    logger.info({ url }, 'Starting site crawl via Crawl360 /v1/crawl');

    const apiKey = await this.getApiKey();
    if (!apiKey) {
      logger.error('CRAWL360_API_KEY not configured');
      return emptyResult(url, 'CRAWL360_API_KEY not configured', 'blocked');
    }

    const baseUrl = new URL(url).origin;

    // ── Step 1: Start crawl job ─────────────────────────────────────
    let job: CrawlJobStartResponse;
    try {
      job = await this.startCrawl(apiKey, url);
      logger.info({ url, jobId: job.job_id, estimatedTime: job.estimated_time_seconds }, 'Crawl job started');
    } catch (err) {
      logger.warn({ url, err: String(err) }, 'Crawl360 job start failed');
      return emptyResult(url, `Crawl failed: ${String(err)}`, 'blocked');
    }

    // ── Step 2: Poll until complete ─────────────────────────────────
    let result: CrawlJobPollResponse;
    try {
      result = await this.pollJob(apiKey, job.job_id);
    } catch (err) {
      logger.warn({ url, jobId: job.job_id, err: String(err) }, 'Crawl360 polling failed');
      return emptyResult(url, `Crawl polling failed: ${String(err)}`, 'blocked');
    }

    if (result.status === 'failed' || !result.result?.pages?.length) {
      const errMsg = result.error || 'Crawl returned no pages';
      logger.warn({ url, jobId: job.job_id, error: errMsg }, 'Crawl360 job failed');
      return emptyResult(url, errMsg, 'blocked');
    }

    const pages = result.result.pages;
    const pageCount = pages.length;

    // ── Step 3: Extract data from the first (main) page ─────────────
    const mainPage = pages[0];
    const title = mainPage.metadata?.title || '';
    const meta: CrawlResult['meta'] = {
      description: mainPage.metadata?.description || undefined,
      keywords: undefined,
      ogImage: mainPage.metadata?.opengraph?.['og:image'] || undefined,
      ogTitle: mainPage.metadata?.opengraph?.['og:title'] || undefined,
      canonical: mainPage.metadata?.canonical || undefined,
    };

    // ── Step 4: Aggregate SEO data across all pages ─────────────────
    const schemaTypes: string[] = [];
    const allProducts: CrawlProduct[] = [];
    let usedStealth = false;

    for (const page of pages) {
      if (!page.success) continue;
      if (page.fetcher_used === 'stealth') usedStealth = true;

      // Extract schema types & products from each page
      if (page.metadata?.schemas) {
        for (const schema of page.metadata.schemas) {
          // Crawl360 returns schemas with `type` + `properties` wrapper
          const schemaType = schema.type || schema['@type'];
          if (schemaType) schemaTypes.push(String(schemaType));

          // Extract products from properties (Crawl360 format)
          if (schema.properties) {
            extractProductsFromProps(schema.properties, allProducts, baseUrl);
          }

          // Also handle raw JSON-LD format
          if (schema['@type']) {
            extractProductsFromJsonLd(schema as Record<string, unknown>, allProducts, baseUrl);
          }

          // @graph container
          if (Array.isArray(schema['@graph'])) {
            for (const item of schema['@graph'] as Array<Record<string, unknown>>) {
              const itemType = item['@type'];
              if (itemType) schemaTypes.push(String(itemType));
              extractProductsFromJsonLd(item, allProducts, baseUrl);
            }
          }
        }
      }

      // Extract products from page content text (price patterns like ₹1,234)
      if (page.content?.text) {
        extractProductsFromText(page.content.text, page.headings?.h3 || [], allProducts, baseUrl, page.url);
      }

      // Extract products from links with product-like URLs
      if (page.links) {
        for (const link of page.links) {
          if (link.is_internal && link.text && link.text.length > 3 && link.text.length < 200) {
            const isNavLink = /^(home|about|contact|shop|view|buy|explore|discover|sign|log|cart|checkout|menu|search|help|faq)/i.test(link.text.trim());
            if (!isNavLink && (link.href.includes('/product') || link.href.includes('/jewellery/') || link.href.includes('/collection'))) {
              allProducts.push({
                name: link.text.trim(),
                price: 0,
                currency: 'INR',
                url: link.href.startsWith('http') ? link.href : `${baseUrl}${link.href}`,
              });
            }
          }
        }
      }
    }

    // Collect internal links from main page
    const internalLinks = (mainPage.links || [])
      .filter(l => l.is_internal)
      .map(l => l.href)
      .slice(0, 50);

    const techSeo: CrawlResult['techSeo'] = {
      hasSchema: schemaTypes.length > 0,
      schemaTypes: [...new Set(schemaTypes)],
      h1Tags: mainPage.headings?.h1 || [],
      h2Tags: (mainPage.headings?.h2 || []).slice(0, 10),
      hasOpenGraph: !!(mainPage.metadata?.opengraph?.['og:title']),
      hasSitemap: false,
      robotsTxt: '',
    };

    // ── Step 5: Check sitemap & robots.txt via scrape ───────────────
    try {
      const sitemapResp = await this.scrape(apiKey, `${baseUrl}/sitemap.xml`);
      techSeo.hasSitemap = sitemapResp.success && (sitemapResp.content?.text?.includes('<url') ?? false);
    } catch { /* ignore */ }

    try {
      const robotsResp = await this.scrape(apiKey, `${baseUrl}/robots.txt`);
      if (robotsResp.success && robotsResp.content?.text) {
        techSeo.robotsTxt = robotsResp.content.text.slice(0, 2000);
      }
    } catch { /* ignore */ }

    // ── Step 6: Deduplicate & build result ───────────────────────────
    const uniqueProducts = deduplicateProducts(allProducts);
    const crawlDifficulty: CrawlDifficulty = usedStealth ? 'hard' : 'easy';

    const crawlResult: CrawlResult = {
      url,
      title,
      products: uniqueProducts,
      meta,
      techSeo,
      links: internalLinks,
      pageCount,
      crawledAt: new Date().toISOString(),
      crawlDifficulty,
    };

    logger.info(
      { url, productsFound: uniqueProducts.length, pagesScraped: pageCount, jobId: job.job_id },
      'Crawl360 multi-page crawl completed',
    );

    return crawlResult;
  }

  // ── Crawl360 /v1/crawl — start async job ─────────────────────────

  private async startCrawl(apiKey: string, url: string): Promise<CrawlJobStartResponse> {
    const res = await fetch(`${this.baseUrl}/v1/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        url,
        max_pages: 10,
        max_depth: 2,
        fetcher: 'auto',
        solve_cloudflare: true,
        same_domain_only: true,
        respect_robots: true,
        delay_ms: 500,
        extract: {
          include_text: true,
          include_metadata: true,
          include_links: true,
          include_headings: true,
          include_schemas: true,
          include_images: false,
          include_raw_html: false,
          include_markdown: false,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Crawl360 /v1/crawl ${res.status}: ${errBody}`);
    }

    return (await res.json()) as CrawlJobStartResponse;
  }

  // ── Poll job until completed or failed ────────────────────────────

  private async pollJob(apiKey: string, jobId: string): Promise<CrawlJobPollResponse> {
    const maxWait = 120_000; // 2 minutes max
    const pollInterval = 3_000; // poll every 3 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const res = await fetch(`${this.baseUrl}/v1/jobs/${jobId}`, {
        method: 'GET',
        headers: { 'X-API-Key': apiKey },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Crawl360 poll ${res.status}: ${errBody}`);
      }

      const data = (await res.json()) as CrawlJobPollResponse;

      if (data.status === 'completed' || data.status === 'failed') {
        return data;
      }

      logger.debug(
        { jobId, status: data.status, progress: data.progress },
        'Crawl job still running — polling again',
      );

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Crawl job ${jobId} timed out after ${maxWait / 1000}s`);
  }

  // ── Crawl360 /v1/scrape — for one-off pages (sitemap, robots) ────

  private async scrape(apiKey: string, url: string): Promise<Crawl360Page> {
    const res = await fetch(`${this.baseUrl}/v1/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        url,
        fetcher: 'auto',
        timeout: 30,
        solve_cloudflare: false,
        extract: {
          include_text: true,
          include_metadata: false,
          include_links: false,
          include_headings: false,
          include_schemas: false,
          include_images: false,
          include_raw_html: false,
          include_markdown: false,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Crawl360 scrape ${res.status}: ${errBody}`);
    }

    return (await res.json()) as Crawl360Page;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function emptyResult(url: string, title: string, difficulty: CrawlDifficulty): CrawlResult {
  return {
    url,
    title,
    products: [],
    meta: {},
    techSeo: { hasSchema: false, schemaTypes: [], h1Tags: [], h2Tags: [], hasOpenGraph: false, hasSitemap: false, robotsTxt: '' },
    links: [],
    pageCount: 0,
    crawledAt: new Date().toISOString(),
    crawlDifficulty: difficulty,
  };
}

/** Extract products from Crawl360 schema `properties` wrapper */
function extractProductsFromProps(
  props: Record<string, unknown>,
  products: CrawlProduct[],
  baseUrl: string,
): void {
  const type = props['@type'];
  if (type === 'Product' && props.name) {
    const offers = props.offers as Record<string, unknown> | undefined;
    const price = Number(offers?.price || offers?.lowPrice || 0);
    products.push({
      name: String(props.name),
      price: price || 0,
      currency: String(offers?.priceCurrency || 'INR'),
      url: props.url ? String(props.url) : undefined,
    });
  }

  if (type === 'ItemList' && Array.isArray(props.itemListElement)) {
    for (const listItem of props.itemListElement as Array<Record<string, unknown>>) {
      const item = (listItem.item || listItem) as Record<string, unknown>;
      if (item.name) {
        products.push({
          name: String(item.name),
          price: 0,
          currency: 'INR',
          url: item.url ? String(item.url) : `${baseUrl}`,
        });
      }
    }
  }

  if (Array.isArray(props['@graph'])) {
    for (const item of props['@graph'] as Array<Record<string, unknown>>) {
      extractProductsFromJsonLd(item, products, baseUrl);
    }
  }
}

/** Extract products from raw JSON-LD schema objects */
function extractProductsFromJsonLd(
  schema: Record<string, unknown>,
  products: CrawlProduct[],
  baseUrl: string,
): void {
  if (schema['@type'] === 'Product' && schema.name) {
    const offers = schema.offers as Record<string, unknown> | undefined;
    const price = Number(offers?.price || offers?.lowPrice || 0);
    products.push({
      name: String(schema.name),
      price: price || 0,
      currency: String(offers?.priceCurrency || 'INR'),
      url: schema.url ? String(schema.url) : undefined,
    });
  }

  if (schema['@type'] === 'ItemList' && Array.isArray(schema.itemListElement)) {
    for (const listItem of schema.itemListElement as Array<Record<string, unknown>>) {
      const item = (listItem.item || listItem) as Record<string, unknown>;
      if (item.name) {
        products.push({
          name: String(item.name),
          price: 0,
          currency: 'INR',
          url: item.url ? String(item.url) : `${baseUrl}`,
        });
      }
    }
  }
}

/** Extract products from page text content + h3 headings (product names with prices) */
function extractProductsFromText(
  text: string,
  h3Tags: string[],
  products: CrawlProduct[],
  _baseUrl: string,
  pageUrl: string,
): void {
  // Parse price patterns like "₹6,301" or "₹17,700" from text near product names
  const priceRegex = /₹([\d,]+)/g;
  const prices: number[] = [];
  let match;
  while ((match = priceRegex.exec(text)) !== null) {
    const price = Number(match[1].replace(/,/g, ''));
    if (price >= 100 && price <= 50_000_000) {
      prices.push(price);
    }
  }

  // Use h3 tags as product names (common pattern for jewelry sites)
  for (const heading of h3Tags) {
    const name = heading.trim();
    if (name.length < 4 || name.length > 200) continue;
    if (/^(home|about|contact|shop|view|buy|explore|discover|sign|log|cart|checkout|menu|search|help|faq|your|select|enter|browse|continue)/i.test(name)) continue;
    // Check if it looks like a product name (contains jewelry keywords)
    if (/\b(ring|earring|necklace|bracelet|pendant|bangle|chain|mangalsutra|stud|hoop|diamond|gold|silver|platinum|kundan|polki|solitaire|nose\s*pin|charm)\b/i.test(name)) {
      products.push({
        name,
        price: 0,
        currency: 'INR',
        url: pageUrl,
      });
    }
  }
}

function deduplicateProducts(products: CrawlProduct[]): CrawlProduct[] {
  const seen = new Map<string, CrawlProduct>();
  for (const p of products) {
    const name = p.name.trim();
    if (name.length < 3 || name.length > 200) continue;
    // Filter out garbage
    if (/^(hi[,!]?\s|shop\s|buy\s|view\s|explore\s|discover\s|sign\s|log\s|subscribe|add to|checkout|free |click|learn|read|contact|help|faq|home$|menu$|search$|close$)/i.test(name)) continue;
    // Price sanity for Indian jewelry
    if (p.price > 0 && (p.price < 100 || p.price > 50_000_000)) continue;

    const key = name.toLowerCase();
    // Keep the one with a price if available
    if (!seen.has(key) || (p.price > 0 && (seen.get(key)?.price ?? 0) === 0)) {
      seen.set(key, p);
    }
  }
  return [...seen.values()];
}

// ── Singleton Export ────────────────────────────────────────────────

export const crawler = new CrawlerService();
