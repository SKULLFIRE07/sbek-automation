import type { CrawlResult } from "./crawler.js";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface PriceChange {
  productName: string;
  oldPrice: string;
  newPrice: string;
  changePercent: number;
  direction: "increase" | "decrease";
}

export interface AnalysisResult {
  url: string;
  analyzedAt: string;
  currentCrawl: CrawlResult;
  previousCrawl?: CrawlResult;
  hasPreviousData: boolean;

  // Product changes
  productCount: number;
  previousProductCount: number;
  productCountDelta: number;
  newProducts: Array<{ name: string; price: string; url: string }>;
  removedProducts: Array<{ name: string; price: string; url: string }>;
  priceChanges: PriceChange[];

  // Blog changes
  newBlogPosts: Array<{ title: string; url: string; date?: string }>;

  // Content freshness
  contentFreshnessScore: number; // 0-100

  // SEO
  seoScore: CrawlResult["seoScore"];

  // Summary
  summary: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse a price string into a numeric value.
 * Handles common formats: $19.99, USD 19.99, 19,99, etc.
 */
function parsePrice(price: string): number | null {
  if (!price) return null;

  // Remove currency symbols and text, keep digits, dots, commas
  const cleaned = price.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return null;

  // Handle comma as decimal separator (e.g. 19,99)
  // If there's a comma after a dot, it's likely a thousands separator
  // If there's a comma before a dot, it's likely a thousands separator
  // If there's only a comma and it has exactly 2 digits after it, treat as decimal
  let normalized = cleaned;
  const commaIndex = cleaned.lastIndexOf(",");
  const dotIndex = cleaned.lastIndexOf(".");

  if (commaIndex > dotIndex && cleaned.length - commaIndex === 3) {
    // Comma appears to be a decimal separator (e.g. "19,99")
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // Treat commas as thousands separators
    normalized = cleaned.replace(/,/g, "");
  }

  const value = parseFloat(normalized);
  return isNaN(value) ? null : value;
}

/**
 * Calculate the percentage change between two prices.
 * Returns null if either price cannot be parsed.
 */
function calculatePriceChangePercent(
  oldPrice: string,
  newPrice: string,
): number | null {
  const oldVal = parsePrice(oldPrice);
  const newVal = parsePrice(newPrice);

  if (oldVal === null || newVal === null || oldVal === 0) return null;

  return ((newVal - oldVal) / oldVal) * 100;
}

/**
 * Calculate a content freshness score from 0-100 based on observable signals.
 *
 * Factors:
 * - Blog post count and recency
 * - Product catalog changes
 * - SEO hygiene
 */
function calculateFreshnessScore(
  current: CrawlResult,
  previous?: CrawlResult,
): number {
  let score = 50; // Baseline

  // Blog presence adds up to +15
  if (current.blogPosts.length > 0) {
    score += 10;
    // Recent blog posts (check for dates within last 90 days)
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const recentPosts = current.blogPosts.filter((post) => {
      if (!post.date) return false;
      try {
        const postDate = new Date(post.date).getTime();
        return now - postDate < ninetyDays;
      } catch {
        return false;
      }
    });
    if (recentPosts.length > 0) {
      score += 5;
    }
  }

  // Good SEO signals add up to +20
  if (current.seoScore.hasMetaDescription) score += 5;
  if (current.seoScore.hasH1) score += 5;
  if (current.seoScore.hasOgTags) score += 5;
  if (current.seoScore.hasStructuredData) score += 5;

  // Product catalog richness adds up to +15
  if (current.products.length > 0) score += 5;
  if (current.products.length > 10) score += 5;
  if (current.products.length > 50) score += 5;

  // Changes from previous crawl (if available) indicate active maintenance
  if (previous) {
    const newProducts = current.products.filter(
      (p) =>
        !previous.products.some(
          (pp) => pp.name.toLowerCase() === p.name.toLowerCase(),
        ),
    );
    const newBlogPosts = current.blogPosts.filter(
      (b) =>
        !previous.blogPosts.some(
          (pb) => pb.url === b.url,
        ),
    );

    if (newProducts.length > 0) score += 5;
    if (newBlogPosts.length > 0) score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

// ─── Main analysis function ──────────────────────────────────────────────────

export function analyzeChanges(
  current: CrawlResult,
  previous?: CrawlResult,
): AnalysisResult {
  const hasPreviousData = !!previous;

  // ── Product comparison ─────────────────────────────────────────────
  const newProducts = hasPreviousData
    ? current.products.filter(
        (p) =>
          !previous!.products.some(
            (pp) => pp.name.toLowerCase() === p.name.toLowerCase(),
          ),
      )
    : [];

  const removedProducts = hasPreviousData
    ? previous!.products.filter(
        (pp) =>
          !current.products.some(
            (p) => p.name.toLowerCase() === pp.name.toLowerCase(),
          ),
      )
    : [];

  // ── Price changes (>10% threshold) ─────────────────────────────────
  const priceChanges: PriceChange[] = [];

  if (hasPreviousData) {
    for (const currentProduct of current.products) {
      const previousProduct = previous!.products.find(
        (pp) => pp.name.toLowerCase() === currentProduct.name.toLowerCase(),
      );

      if (!previousProduct) continue;

      const changePercent = calculatePriceChangePercent(
        previousProduct.price,
        currentProduct.price,
      );

      if (changePercent !== null && Math.abs(changePercent) > 10) {
        priceChanges.push({
          productName: currentProduct.name,
          oldPrice: previousProduct.price,
          newPrice: currentProduct.price,
          changePercent: Math.round(changePercent * 100) / 100,
          direction: changePercent > 0 ? "increase" : "decrease",
        });
      }
    }
  }

  // ── Blog comparison ────────────────────────────────────────────────
  const newBlogPosts = hasPreviousData
    ? current.blogPosts.filter(
        (b) => !previous!.blogPosts.some((pb) => pb.url === b.url),
      )
    : current.blogPosts;

  // ── Content freshness ──────────────────────────────────────────────
  const contentFreshnessScore = calculateFreshnessScore(current, previous);

  // ── Summary generation ─────────────────────────────────────────────
  const summaryParts: string[] = [];

  summaryParts.push(
    `Crawled ${current.url} on ${new Date(current.crawledAt).toLocaleDateString()}.`,
  );
  summaryParts.push(
    `Found ${current.products.length} products and ${current.blogPosts.length} blog posts.`,
  );

  if (hasPreviousData) {
    const delta = current.products.length - previous!.products.length;
    if (delta > 0) {
      summaryParts.push(`Product catalog grew by ${delta} items.`);
    } else if (delta < 0) {
      summaryParts.push(
        `Product catalog shrank by ${Math.abs(delta)} items.`,
      );
    }

    if (newProducts.length > 0) {
      summaryParts.push(`${newProducts.length} new product(s) added.`);
    }
    if (removedProducts.length > 0) {
      summaryParts.push(`${removedProducts.length} product(s) removed.`);
    }
    if (priceChanges.length > 0) {
      summaryParts.push(
        `${priceChanges.length} significant price change(s) detected.`,
      );
    }
    if (newBlogPosts.length > 0) {
      summaryParts.push(`${newBlogPosts.length} new blog post(s) published.`);
    }
  }

  summaryParts.push(`Content freshness score: ${contentFreshnessScore}/100.`);

  if (current.error) {
    summaryParts.push(`Warning: ${current.error}`);
  }

  return {
    url: current.url,
    analyzedAt: new Date().toISOString(),
    currentCrawl: current,
    previousCrawl: previous,
    hasPreviousData,
    productCount: current.products.length,
    previousProductCount: previous?.products.length ?? 0,
    productCountDelta: hasPreviousData
      ? current.products.length - previous!.products.length
      : 0,
    newProducts,
    removedProducts,
    priceChanges,
    newBlogPosts,
    contentFreshnessScore,
    seoScore: current.seoScore,
    summary: summaryParts.join(" "),
  };
}
