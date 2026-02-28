import { chromium } from "playwright";
import * as cheerio from "cheerio";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface CrawlResult {
  url: string;
  crawledAt: string;
  homepage: {
    title: string;
    metaDescription: string;
    h1: string[];
    metaKeywords: string;
    ogImage: string;
  };
  products: Array<{
    name: string;
    price: string;
    url: string;
  }>;
  blogPosts: Array<{
    title: string;
    url: string;
    date?: string;
  }>;
  navigation: string[];
  productCount: number;
  seoScore: {
    hasMetaDescription: boolean;
    hasH1: boolean;
    hasOgTags: boolean;
    hasStructuredData: boolean;
  };
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REALISTIC_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Polite delay between page loads (2-3 seconds, randomised). */
function politeDelay(): Promise<void> {
  const ms = 2000 + Math.random() * 1000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolve a possibly-relative URL against a base. */
function resolveUrl(base: string, href: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

/** Check robots.txt to see if crawling the path is allowed. */
async function isAllowedByRobots(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;
    const response = await fetch(robotsUrl, {
      headers: { "User-Agent": REALISTIC_USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      // No robots.txt or error means we assume crawling is allowed
      return true;
    }

    const text = await response.text();
    const lines = text.split("\n");

    let relevantSection = false;
    const pathname = parsed.pathname;

    for (const rawLine of lines) {
      const line = rawLine.trim().toLowerCase();

      if (line.startsWith("user-agent:")) {
        const agent = line.replace("user-agent:", "").trim();
        relevantSection = agent === "*" || agent === "crawler";
      }

      if (relevantSection && line.startsWith("disallow:")) {
        const disallowed = line.replace("disallow:", "").trim();
        if (disallowed && pathname.startsWith(disallowed)) {
          return false;
        }
      }
    }

    return true;
  } catch {
    // If we cannot fetch robots.txt, assume allowed
    return true;
  }
}

// ─── Product extraction patterns ─────────────────────────────────────────────

/** Common selectors for product names in e-commerce sites. */
const PRODUCT_NAME_SELECTORS = [
  ".product-card__title",
  ".product-title",
  ".product-card h2",
  ".product-card h3",
  ".product-item__title",
  ".product-name",
  ".card__heading a",
  ".card__title",
  ".grid-product__title",
  "[data-product-title]",
  ".ProductItem__Title",
  ".product-grid-item .title",
  ".product-list-item .title",
  ".product h2 a",
  ".product h3 a",
  ".collection-product-card .title",
  "h2.product__title",
  "h3.product__title",
];

/** Common selectors for product prices. */
const PRODUCT_PRICE_SELECTORS = [
  ".product-card__price",
  ".product-price",
  ".price",
  ".product-item__price",
  ".money",
  ".card__price",
  ".grid-product__price",
  "[data-product-price]",
  ".ProductItem__Price",
  ".product-grid-item .price",
  ".product-list-item .price",
  ".Price--highlight",
  "span.price",
  ".price-item",
  ".price__regular",
];

/** Common selectors for product links. */
const PRODUCT_LINK_SELECTORS = [
  'a[href*="/products/"]',
  'a[href*="/product/"]',
  'a[href*="/shop/"]',
  'a[href*="/collections/"] .product',
  ".product-card a",
  ".product-item a",
  ".grid-product a",
  ".ProductItem a",
];

// ─── Blog extraction patterns ────────────────────────────────────────────────

const BLOG_LINK_PATTERNS = [
  /\/blog\//i,
  /\/journal\//i,
  /\/news\//i,
  /\/articles?\//i,
  /\/stories\//i,
  /\/posts?\//i,
];

const BLOG_ENTRY_SELECTORS = [
  ".blog-post",
  ".article-card",
  ".blog-card",
  ".post-card",
  ".article-item",
  ".blog-entry",
  ".journal-entry",
  ".article",
  'article[class*="blog"]',
  'article[class*="post"]',
  '[class*="BlogItem"]',
];

// ─── Main crawl function ─────────────────────────────────────────────────────

export async function crawlSite(
  url: string,
  _customSelectors?: Record<string, string>,
): Promise<CrawlResult> {
  const result: CrawlResult = {
    url,
    crawledAt: new Date().toISOString(),
    homepage: {
      title: "",
      metaDescription: "",
      h1: [],
      metaKeywords: "",
      ogImage: "",
    },
    products: [],
    blogPosts: [],
    navigation: [],
    productCount: 0,
    seoScore: {
      hasMetaDescription: false,
      hasH1: false,
      hasOgTags: false,
      hasStructuredData: false,
    },
  };

  // Check robots.txt
  const allowed = await isAllowedByRobots(url);
  if (!allowed) {
    result.error = "Crawling disallowed by robots.txt";
    console.warn(`[crawler] robots.txt disallows crawling ${url}`);
    return result;
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
      userAgent: REALISTIC_USER_AGENT,
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
    });

    const page = await context.newPage();

    // ── Homepage crawl ──────────────────────────────────────────────────
    console.log(`[crawler] Navigating to ${url}`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      // Give JS-rendered content a moment to appear
      await page.waitForTimeout(2000);
    } catch (navError) {
      result.error = `Navigation failed: ${navError instanceof Error ? navError.message : String(navError)}`;
      console.error(`[crawler] Navigation error for ${url}:`, navError);
      await browser.close();
      return result;
    }

    const html = await page.content();
    const $ = cheerio.load(html);

    // ── Extract homepage metadata ───────────────────────────────────────
    result.homepage.title = $("title").first().text().trim();
    result.homepage.metaDescription =
      $('meta[name="description"]').attr("content")?.trim() || "";
    result.homepage.h1 = $("h1")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
    result.homepage.metaKeywords =
      $('meta[name="keywords"]').attr("content")?.trim() || "";
    result.homepage.ogImage =
      $('meta[property="og:image"]').attr("content")?.trim() || "";

    // ── SEO score ───────────────────────────────────────────────────────
    result.seoScore.hasMetaDescription =
      result.homepage.metaDescription.length > 0;
    result.seoScore.hasH1 = result.homepage.h1.length > 0;
    result.seoScore.hasOgTags =
      !!$('meta[property="og:title"]').attr("content") ||
      !!$('meta[property="og:image"]').attr("content");
    result.seoScore.hasStructuredData =
      $('script[type="application/ld+json"]').length > 0;

    // ── Extract navigation ──────────────────────────────────────────────
    const navLinks = new Set<string>();
    $(
      "nav a, header a, .header a, .main-nav a, .site-nav a, .navbar a",
    ).each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length < 50) {
        navLinks.add(text);
      }
    });
    result.navigation = Array.from(navLinks);

    // ── Extract products from homepage ──────────────────────────────────
    extractProducts($, url, result);

    // ── Try to find and crawl a product listing page ────────────────────
    const productPageUrls = findProductPageUrls($, url);

    if (result.products.length === 0 && productPageUrls.length > 0) {
      // Crawl the first product listing page found
      const productPageUrl = productPageUrls[0];
      console.log(
        `[crawler] No products on homepage, visiting ${productPageUrl}`,
      );

      await politeDelay();

      try {
        await page.goto(productPageUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page.waitForTimeout(2000);

        const productHtml = await page.content();
        const $product = cheerio.load(productHtml);
        extractProducts($product, productPageUrl, result);
      } catch (err) {
        console.warn(
          `[crawler] Failed to crawl product page ${productPageUrl}:`,
          err,
        );
      }
    }

    // ── Try to find and crawl a blog/journal page ───────────────────────
    extractBlogPosts($, url, result);

    const blogPageUrls = findBlogPageUrls($, url);

    if (result.blogPosts.length === 0 && blogPageUrls.length > 0) {
      const blogPageUrl = blogPageUrls[0];
      console.log(
        `[crawler] No blog posts on homepage, visiting ${blogPageUrl}`,
      );

      await politeDelay();

      try {
        await page.goto(blogPageUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page.waitForTimeout(2000);

        const blogHtml = await page.content();
        const $blog = cheerio.load(blogHtml);
        extractBlogPosts($blog, blogPageUrl, result);
      } catch (err) {
        console.warn(
          `[crawler] Failed to crawl blog page ${blogPageUrl}:`,
          err,
        );
      }
    }

    result.productCount = result.products.length;

    await browser.close();
    console.log(
      `[crawler] Finished crawling ${url}: ${result.products.length} products, ${result.blogPosts.length} blog posts`,
    );
  } catch (err) {
    result.error = `Crawl error: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[crawler] Fatal error crawling ${url}:`, err);
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  return result;
}

// ─── Extraction helpers ──────────────────────────────────────────────────────

function extractProducts(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  result: CrawlResult,
): void {
  const seenNames = new Set(result.products.map((p) => p.name.toLowerCase()));

  // Strategy 1: Look for product cards with structured name + price + link
  for (const nameSelector of PRODUCT_NAME_SELECTORS) {
    $(nameSelector).each((_, el) => {
      const name = $(el).text().trim();
      if (!name || name.length > 200 || seenNames.has(name.toLowerCase())) {
        return;
      }

      // Try to find the closest ancestor that looks like a product card
      const card =
        $(el).closest(
          '[class*="product"], [class*="card"], [class*="grid-item"], [class*="Product"]',
        ) || $(el).parent();

      // Extract price from within the same card
      let price = "";
      for (const priceSelector of PRODUCT_PRICE_SELECTORS) {
        const priceEl = card.find(priceSelector).first();
        if (priceEl.length) {
          price = priceEl.text().trim();
          break;
        }
      }

      // Extract URL
      let productUrl = "";
      const linkEl =
        $(el).closest("a").attr("href") ||
        card.find("a").first().attr("href") ||
        "";
      if (linkEl) {
        productUrl = resolveUrl(baseUrl, linkEl);
      }

      if (name) {
        seenNames.add(name.toLowerCase());
        result.products.push({ name, price, url: productUrl });
      }
    });
  }

  // Strategy 2: Look for product links directly
  if (result.products.length === 0) {
    for (const linkSelector of PRODUCT_LINK_SELECTORS) {
      $(linkSelector).each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;

        const fullUrl = resolveUrl(baseUrl, href);
        const name =
          $(el).text().trim() ||
          $(el).attr("title")?.trim() ||
          $(el).find("img").attr("alt")?.trim() ||
          "";

        if (
          name &&
          name.length < 200 &&
          !seenNames.has(name.toLowerCase())
        ) {
          seenNames.add(name.toLowerCase());

          // Try to find price near this link
          let price = "";
          const parent = $(el).parent();
          for (const priceSelector of PRODUCT_PRICE_SELECTORS) {
            const priceEl = parent.find(priceSelector).first();
            if (priceEl.length) {
              price = priceEl.text().trim();
              break;
            }
          }

          result.products.push({ name, price, url: fullUrl });
        }
      });
    }
  }

  // Strategy 3: Look for JSON-LD structured data for products
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || "");
      const items = Array.isArray(json) ? json : [json];

      for (const item of items) {
        if (
          item["@type"] === "Product" ||
          item["@type"] === "ProductGroup"
        ) {
          const name = item.name?.trim();
          if (name && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            const price =
              item.offers?.price ||
              item.offers?.lowPrice ||
              item.offers?.[0]?.price ||
              "";
            const currency =
              item.offers?.priceCurrency ||
              item.offers?.[0]?.priceCurrency ||
              "";
            result.products.push({
              name,
              price: price ? `${currency} ${price}`.trim() : "",
              url: item.url || "",
            });
          }
        }

        // Handle ItemList containing products
        if (item["@type"] === "ItemList" && Array.isArray(item.itemListElement)) {
          for (const listItem of item.itemListElement) {
            const product = listItem.item || listItem;
            if (
              product["@type"] === "Product" ||
              product["@type"] === "ProductGroup"
            ) {
              const name = product.name?.trim();
              if (name && !seenNames.has(name.toLowerCase())) {
                seenNames.add(name.toLowerCase());
                const price =
                  product.offers?.price ||
                  product.offers?.lowPrice ||
                  "";
                const currency =
                  product.offers?.priceCurrency || "";
                result.products.push({
                  name,
                  price: price
                    ? `${currency} ${price}`.trim()
                    : "",
                  url: product.url || "",
                });
              }
            }
          }
        }
      }
    } catch {
      // JSON-LD parse error, skip
    }
  });
}

function extractBlogPosts(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  result: CrawlResult,
): void {
  const seenUrls = new Set(result.blogPosts.map((b) => b.url));

  // Strategy 1: Look for blog entry containers
  for (const selector of BLOG_ENTRY_SELECTORS) {
    $(selector).each((_, el) => {
      const titleEl =
        $(el).find("h2, h3, h1, .title, .entry-title").first();
      const title = titleEl.text().trim();

      const linkEl =
        titleEl.closest("a").attr("href") ||
        titleEl.find("a").attr("href") ||
        $(el).find("a").first().attr("href") ||
        "";
      const postUrl = linkEl ? resolveUrl(baseUrl, linkEl) : "";

      if (title && postUrl && !seenUrls.has(postUrl)) {
        seenUrls.add(postUrl);

        // Try to find a date
        const dateEl = $(el).find("time, .date, .published, .post-date").first();
        const date =
          dateEl.attr("datetime")?.trim() || dateEl.text().trim() || undefined;

        result.blogPosts.push({ title, url: postUrl, date });
      }
    });
  }

  // Strategy 2: Look for links matching blog URL patterns
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const fullUrl = resolveUrl(baseUrl, href);
    if (seenUrls.has(fullUrl)) return;

    const matchesBlogPattern = BLOG_LINK_PATTERNS.some((pattern) =>
      pattern.test(href),
    );
    if (!matchesBlogPattern) return;

    // Skip navigation/category links (short text or generic labels)
    const text = $(el).text().trim();
    if (!text || text.length < 5 || text.length > 200) return;

    const genericLabels = [
      "blog",
      "journal",
      "news",
      "read more",
      "view all",
      "see all",
    ];
    if (genericLabels.includes(text.toLowerCase())) return;

    seenUrls.add(fullUrl);
    result.blogPosts.push({ title: text, url: fullUrl });
  });
}

function findProductPageUrls(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): string[] {
  const urls: string[] = [];
  const productPathPatterns = [
    /\/collections\b/i,
    /\/products\b/i,
    /\/shop\b/i,
    /\/store\b/i,
    /\/catalog\b/i,
  ];

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    if (productPathPatterns.some((p) => p.test(href))) {
      const fullUrl = resolveUrl(baseUrl, href);
      if (!urls.includes(fullUrl)) {
        urls.push(fullUrl);
      }
    }
  });

  return urls.slice(0, 5); // Limit to first 5 discovered
}

function findBlogPageUrls(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): string[] {
  const urls: string[] = [];

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    if (BLOG_LINK_PATTERNS.some((p) => p.test(href))) {
      const fullUrl = resolveUrl(baseUrl, href);
      // Only collect root blog/journal pages, not individual posts
      try {
        const parsed = new URL(fullUrl);
        const pathParts = parsed.pathname
          .split("/")
          .filter(Boolean);
        if (pathParts.length <= 2 && !urls.includes(fullUrl)) {
          urls.push(fullUrl);
        }
      } catch {
        // Skip invalid URLs
      }
    }
  });

  return urls.slice(0, 3);
}
