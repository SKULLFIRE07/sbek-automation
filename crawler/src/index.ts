import express from "express";
import rateLimit from "express-rate-limit";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { crawlSite } from "./crawler.js";
import { analyzeChanges } from "./analyzer.js";
import { generateReport } from "./reporter.js";
import type { CrawlResult } from "./crawler.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const REPORTS_DIR = process.env.REPORTS_DIR || "/app/reports";

app.use(express.json());

// Rate limit: 10 requests per minute
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please wait before making another request.",
    retryAfterSeconds: 60,
  },
});

app.use(limiter);

// ─── Health check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "sbek-crawler",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /crawl ─────────────────────────────────────────────────────────────
interface CrawlRequest {
  url: string;
  selectors?: Record<string, string>;
  previousCrawl?: CrawlResult;
  competitorName?: string;
}

app.post("/crawl", async (req, res) => {
  const { url, selectors, previousCrawl, competitorName } =
    req.body as CrawlRequest;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "A valid 'url' field is required." });
    return;
  }

  // Basic URL validation
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    res.status(400).json({ error: "Invalid URL. Must be http or https." });
    return;
  }

  console.log(`[crawl] Starting crawl for ${url}`);
  const startTime = Date.now();

  try {
    const crawlResult = await crawlSite(url, selectors);
    const elapsedMs = Date.now() - startTime;
    console.log(`[crawl] Completed crawl for ${url} in ${elapsedMs}ms`);

    // Analyze changes if a previous crawl was provided
    const analysis = analyzeChanges(crawlResult, previousCrawl);

    // Generate report
    const domain = parsedUrl.hostname.replace(/^www\./, "");
    const reportName = competitorName || domain;
    const reportHtml = generateReport(analysis, reportName, REPORTS_DIR);

    res.json({
      success: true,
      elapsedMs,
      crawl: crawlResult,
      analysis,
      reportHtml,
    });
  } catch (err) {
    const elapsedMs = Date.now() - startTime;
    console.error(`[crawl] Error crawling ${url}:`, err);
    res.status(500).json({
      success: false,
      elapsedMs,
      error:
        err instanceof Error ? err.message : "Unknown error during crawl.",
    });
  }
});

// ─── GET /reports ────────────────────────────────────────────────────────────
app.get("/reports", async (_req, res) => {
  try {
    const files = await readdir(REPORTS_DIR).catch(() => [] as string[]);
    const reports = files
      .filter((f) => f.endsWith(".html"))
      .sort()
      .reverse()
      .map((filename) => ({
        filename,
        path: path.join(REPORTS_DIR, filename),
        url: `/reports/${filename}`,
      }));
    res.json({ reports });
  } catch (err) {
    console.error("[reports] Error listing reports:", err);
    res.status(500).json({ error: "Failed to list reports." });
  }
});

// Serve report files statically
app.use("/reports", express.static(REPORTS_DIR));

// ─── Start server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`sbek-crawler listening on port ${PORT}`);
  console.log(`Reports directory: ${REPORTS_DIR}`);
});

export default app;
