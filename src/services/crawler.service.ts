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

// ── Crawl360 API response types ─────────────────────────────────────

interface Crawl360Response {
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
    schemas?: Array<Record<string, unknown>>;
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

// ── Known product listing paths for Indian jewelry competitors ──────

const KNOWN_PRODUCT_PATHS: Record<string, string[]> = {
  'tanishq.co.in': ['/jewellery/all.html', '/jewellery/gold.html', '/jewellery/diamond.html', '/collections'],
  'caratlane.com': ['/jewellery.html', '/rings.html', '/earrings.html', '/necklaces.html', '/bracelets.html'],
  'bluestone.com': ['/jewellery.html', '/rings.html', '/earrings.html', '/pendants.html'],
  'kalyanjewellers.net': ['/gold-jewellery-designs.php', '/diamond-jewellery-designs.php'],
  'melorra.com': ['/jewellery', '/earrings', '/rings', '/necklaces', '/bracelets'],
  'pngjewellers.com': ['/collections/all', '/collections/gold-jewellery', '/collections/diamond-jewellery'],
};

// ── Service ─────────────────────────────────────────────────────────

class CrawlerService {
  private readonly apiUrl = 'https://crawl.360labs.ai/v1/scrape';

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
   * Crawl a competitor site using Crawl360 API.
   * Scrapes main page + product sub-pages, extracts products & SEO data.
   */
  async analyzeSite(url: string, _previousCrawl?: Record<string, unknown>): Promise<CrawlResult> {
    logger.info({ url }, 'Starting site crawl via Crawl360');

    const apiKey = await this.getApiKey();
    if (!apiKey) {
      logger.error('CRAWL360_API_KEY not configured');
      return emptyResult(url, 'CRAWL360_API_KEY not configured', 'blocked');
    }

    const hostname = new URL(url).hostname.replace('www.', '');
    const baseUrl = new URL(url).origin;

    // ── Step 1: Scrape main page ──────────────────────────────────
    let mainPage: Crawl360Response;
    try {
      mainPage = await this.scrape(apiKey, url);
    } catch (err) {
      logger.warn({ url, err: String(err) }, 'Crawl360 main page scrape failed');
      return emptyResult(url, `Crawl failed: ${String(err)}`, 'blocked');
    }

    if (!mainPage.success) {
      return emptyResult(url, 'Crawl360 returned unsuccessful', 'blocked');
    }

    // ── Step 2: Extract SEO data from main page ───────────────────
    const title = mainPage.metadata?.title || '';
    const meta: CrawlResult['meta'] = {
      description: mainPage.metadata?.description || undefined,
      keywords: undefined, // Crawl360 doesn't return meta keywords separately
      ogImage: mainPage.metadata?.opengraph?.['og:image'] || undefined,
      ogTitle: mainPage.metadata?.opengraph?.['og:title'] || undefined,
      canonical: mainPage.metadata?.canonical || undefined,
    };

    // Schema types from JSON-LD
    const schemaTypes: string[] = [];
    if (mainPage.metadata?.schemas) {
      for (const schema of mainPage.metadata.schemas) {
        if (schema['@type']) schemaTypes.push(String(schema['@type']));
        if (Array.isArray(schema['@graph'])) {
          for (const item of schema['@graph'] as Array<Record<string, unknown>>) {
            if (item['@type']) schemaTypes.push(String(item['@type']));
          }
        }
      }
    }

    const techSeo: CrawlResult['techSeo'] = {
      hasSchema: schemaTypes.length > 0,
      schemaTypes,
      h1Tags: mainPage.headings?.h1 || [],
      h2Tags: (mainPage.headings?.h2 || []).slice(0, 10),
      hasOpenGraph: !!(mainPage.metadata?.opengraph?.['og:title']),
      hasSitemap: false,
      robotsTxt: '',
    };

    // Internal links
    const internalLinks = (mainPage.links || [])
      .filter(l => l.is_internal)
      .map(l => l.href)
      .slice(0, 50);

    // ── Step 3: Extract products from schemas on main page ────────
    const allProducts: CrawlProduct[] = [];
    if (mainPage.metadata?.schemas) {
      allProducts.push(...extractProductsFromSchemas(mainPage.metadata.schemas, baseUrl));
    }

    // ── Step 4: Scrape product sub-pages ──────────────────────────
    // Find product/collection pages from links + known paths
    const productLinks = internalLinks
      .filter(l => /\/(product|shop|collection|jewel|ring|necklace|earring|bracelet|pendant|category|catalog|bangles|chains|mangalsutra|gold|diamond|silver|platinum|solitaire)/i.test(l))
      .slice(0, 4);

    const knownPaths = KNOWN_PRODUCT_PATHS[hostname] || [];
    const subPages = [...new Set([...productLinks, ...knownPaths])].slice(0, 6);

    let pageCount = 1;

    for (const path of subPages) {
      if (allProducts.length >= 50) break;

      const subUrl = path.startsWith('http') ? path : `${baseUrl}${path}`;
      try {
        const subPage = await this.scrape(apiKey, subUrl);
        if (subPage.success) {
          pageCount++;
          // Extract products from schemas
          if (subPage.metadata?.schemas) {
            allProducts.push(...extractProductsFromSchemas(subPage.metadata.schemas, baseUrl));
          }
          // Extract products from HTML content (links with product-like patterns)
          if (subPage.links) {
            for (const link of subPage.links) {
              if (link.is_internal && link.text && link.text.length > 3 && link.text.length < 200) {
                const isProductName = !(/^(home|about|contact|shop|view|buy|explore|discover|sign|log|cart|checkout|menu|search|help|faq)/i.test(link.text.trim()));
                if (isProductName && link.href.includes('/product') || link.href.includes('/collection')) {
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
      } catch (err) {
        logger.warn({ url: subUrl, err: String(err) }, 'Sub-page crawl failed — skipping');
      }
    }

    // ── Step 5: Check sitemap & robots.txt ─────────────────────────
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

    // ── Step 6: Deduplicate & determine difficulty ─────────────────
    const uniqueProducts = deduplicateProducts(allProducts);
    const crawlDifficulty: CrawlDifficulty = mainPage.fetcher_used === 'stealth' ? 'hard' : 'easy';

    const result: CrawlResult = {
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
      { url, productsFound: uniqueProducts.length, pagesScraped: pageCount, fetcher: mainPage.fetcher_used },
      'Crawl360 crawl completed',
    );

    return result;
  }

  // ── Crawl360 API call ──────────────────────────────────────────

  private async scrape(apiKey: string, url: string): Promise<Crawl360Response> {
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        url,
        fetcher: 'auto',
        timeout: 30,
        solve_cloudflare: true,
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
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Crawl360 API ${res.status}: ${errBody}`);
    }

    return (await res.json()) as Crawl360Response;
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

function extractProductsFromSchemas(schemas: Array<Record<string, unknown>>, _baseUrl: string): CrawlProduct[] {
  const products: CrawlProduct[] = [];

  for (const schema of schemas) {
    // Direct Product
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

    // ItemList (Melorra uses this)
    if (schema['@type'] === 'ItemList' && Array.isArray(schema.itemListElement)) {
      for (const listItem of schema.itemListElement as Array<Record<string, unknown>>) {
        const item = (listItem.item || listItem) as Record<string, unknown>;
        if (item.name) {
          products.push({
            name: String(item.name),
            price: 0,
            currency: 'INR',
            url: item.url ? String(item.url) : undefined,
          });
        }
      }
    }

    // @graph container
    if (Array.isArray(schema['@graph'])) {
      for (const item of schema['@graph'] as Array<Record<string, unknown>>) {
        if (item['@type'] === 'Product' && item.name) {
          const offers = item.offers as Record<string, unknown> | undefined;
          const price = Number(offers?.price || offers?.lowPrice || 0);
          products.push({
            name: String(item.name),
            price: price || 0,
            currency: String(offers?.priceCurrency || 'INR'),
            url: item.url ? String(item.url) : undefined,
          });
        }
      }
    }
  }

  return products;
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
    if (!seen.has(key)) {
      seen.set(key, p);
    }
  }
  return [...seen.values()];
}

// ── Singleton Export ────────────────────────────────────────────────

export const crawler = new CrawlerService();
