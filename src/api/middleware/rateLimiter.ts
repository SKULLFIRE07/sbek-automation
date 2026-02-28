import rateLimit from 'express-rate-limit';

// ---------------------------------------------------------------------------
// General API rate limiter — 100 requests per 15 minutes per IP
// ---------------------------------------------------------------------------

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000, // 15 minutes
  limit: 100,
  standardHeaders: 'draft-7', // RateLimit-* headers (IETF draft)
  legacyHeaders: false,       // Disable X-RateLimit-* headers
  message: {
    error: true,
    message: 'Too many requests — please try again later',
  },
});

// ---------------------------------------------------------------------------
// Webhook rate limiter — 300 requests per minute
//
// WooCommerce can fire many webhooks in quick succession (e.g. bulk order
// status changes), so this limit is intentionally generous.
// ---------------------------------------------------------------------------

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1_000, // 1 minute
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: true,
    message: 'Webhook rate limit exceeded',
  },
});

// ---------------------------------------------------------------------------
// Crawler rate limiter — 10 requests per minute
//
// Crawl / scrape endpoints are expensive; keep the concurrency low.
// ---------------------------------------------------------------------------

export const crawlerLimiter = rateLimit({
  windowMs: 60 * 1_000, // 1 minute
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: true,
    message: 'Crawler rate limit exceeded — slow down',
  },
});
