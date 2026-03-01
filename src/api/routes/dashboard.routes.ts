import { Router, type Request, type Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import nodemailer from 'nodemailer';
import { queues } from '../../queues/registry.js';
import { db } from '../../config/database.js';
import { pool } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { jobLogs, webhookEvents, cronRuns, competitorSnapshots } from '../../db/schema.js';
import { desc, eq } from 'drizzle-orm';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { settings, CONFIGURABLE_KEYS, type ConfigurableKey } from '../../services/settings.service.js';

const execAsync = promisify(exec);

export const dashboardRouter = Router();

// ── Aggregated Stats ────────────────────────────────────────────────────

dashboardRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const allQueues = queues.getAll();
    const queueData = await Promise.all(
      allQueues.map(async (q) => {
        const counts = await q.getJobCounts();
        return { name: q.name, counts };
      })
    );

    let totalCompleted = 0;
    let totalFailed = 0;
    let totalActive = 0;
    let totalWaiting = 0;
    let totalDelayed = 0;

    for (const q of queueData) {
      totalCompleted += (q.counts as Record<string, number>).completed ?? 0;
      totalFailed += (q.counts as Record<string, number>).failed ?? 0;
      totalActive += (q.counts as Record<string, number>).active ?? 0;
      totalWaiting += (q.counts as Record<string, number>).waiting ?? 0;
      totalDelayed += (q.counts as Record<string, number>).delayed ?? 0;
    }

    const totalProcessed = totalCompleted + totalFailed;
    const successRate = totalProcessed > 0
      ? Math.round((totalCompleted / totalProcessed) * 10000) / 100
      : 100;

    res.json({
      totalProcessed,
      totalCompleted,
      totalFailed,
      totalActive,
      totalWaiting,
      totalDelayed,
      successRate,
      activeQueues: queueData.filter(
        (q) => ((q.counts as Record<string, number>).active ?? 0) > 0
      ).length,
      totalQueues: allQueues.length,
    });
  } catch (err) {
    logger.error({ err }, 'Dashboard stats error');
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── All Queues ──────────────────────────────────────────────────────────

dashboardRouter.get('/queues', async (_req: Request, res: Response) => {
  try {
    const allQueues = queues.getAll();
    const data = await Promise.all(
      allQueues.map(async (q) => {
        const counts = await q.getJobCounts();
        return { name: q.name, ...counts };
      })
    );
    res.json({ queues: data });
  } catch (err) {
    logger.error({ err }, 'Dashboard queues error');
    res.status(500).json({ error: 'Failed to fetch queues' });
  }
});

// ── Single Queue Detail ─────────────────────────────────────────────────

dashboardRouter.get('/queues/:name', async (req: Request, res: Response) => {
  try {
    const allQueues = queues.getAll();
    const queue = allQueues.find((q) => q.name === req.params.name);
    if (!queue) {
      res.status(404).json({ error: 'Queue not found' });
      return;
    }

    const counts = await queue.getJobCounts();
    const recentCompleted = await queue.getJobs(['completed'], 0, 19);
    const recentFailed = await queue.getJobs(['failed'], 0, 19);
    const recentActive = await queue.getJobs(['active'], 0, 9);
    const recentWaiting = await queue.getJobs(['waiting'], 0, 9);
    const recentDelayed = await queue.getJobs(['delayed'], 0, 9);

    const formatJob = (j: { id?: string; name: string; data: unknown; timestamp: number; processedOn?: number; finishedOn?: number; attemptsMade: number; failedReason?: string; returnvalue?: unknown }) => ({
      id: j.id,
      name: j.name,
      data: j.data,
      timestamp: j.timestamp,
      processedOn: j.processedOn,
      finishedOn: j.finishedOn,
      attempts: j.attemptsMade,
      failedReason: j.failedReason,
      returnvalue: j.returnvalue,
    });

    res.json({
      name: queue.name,
      counts,
      recentJobs: {
        completed: recentCompleted.map(formatJob),
        failed: recentFailed.map(formatJob),
        active: recentActive.map(formatJob),
        waiting: recentWaiting.map(formatJob),
        delayed: recentDelayed.map(formatJob),
      },
    });
  } catch (err) {
    logger.error({ err }, 'Dashboard queue detail error');
    res.status(500).json({ error: 'Failed to fetch queue detail' });
  }
});

// ── Queue Jobs (paginated) ──────────────────────────────────────────────

dashboardRouter.get('/queues/:name/jobs', async (req: Request, res: Response) => {
  try {
    const allQueues = queues.getAll();
    const queue = allQueues.find((q) => q.name === req.params.name);
    if (!queue) {
      res.status(404).json({ error: 'Queue not found' });
      return;
    }

    const status = (req.query.status as string) || 'completed';
    const start = parseInt(req.query.start as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const validStatuses = ['completed', 'failed', 'active', 'waiting', 'delayed'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Use: ${validStatuses.join(', ')}` });
      return;
    }

    const jobs = await queue.getJobs([status as 'completed' | 'failed' | 'active' | 'waiting' | 'delayed'], start, start + limit - 1);
    res.json({
      queue: queue.name,
      status,
      start,
      limit,
      count: jobs.length,
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        data: j.data,
        timestamp: j.timestamp,
        processedOn: j.processedOn,
        finishedOn: j.finishedOn,
        attempts: j.attemptsMade,
        failedReason: j.failedReason,
        returnvalue: j.returnvalue,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Dashboard queue jobs error');
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// ── Retry All Failed ────────────────────────────────────────────────────

dashboardRouter.post('/queues/:name/retry-all', async (req: Request, res: Response) => {
  try {
    const allQueues = queues.getAll();
    const queue = allQueues.find((q) => q.name === req.params.name);
    if (!queue) {
      res.status(404).json({ error: 'Queue not found' });
      return;
    }

    const failed = await queue.getJobs(['failed']);
    let retried = 0;
    for (const job of failed) {
      await job.retry();
      retried++;
    }

    res.json({ queue: queue.name, retried });
  } catch (err) {
    logger.error({ err }, 'Dashboard retry-all error');
    res.status(500).json({ error: 'Failed to retry jobs' });
  }
});

// ── Clean Queue ─────────────────────────────────────────────────────────

dashboardRouter.post('/queues/:name/clean', async (req: Request, res: Response) => {
  try {
    const allQueues = queues.getAll();
    const queue = allQueues.find((q) => q.name === req.params.name);
    if (!queue) {
      res.status(404).json({ error: 'Queue not found' });
      return;
    }

    const completedCleaned = await queue.clean(0, 1000, 'completed');
    const failedCleaned = await queue.clean(0, 1000, 'failed');

    res.json({
      queue: queue.name,
      cleaned: {
        completed: completedCleaned.length,
        failed: failedCleaned.length,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Dashboard clean error');
    res.status(500).json({ error: 'Failed to clean queue' });
  }
});

// ── System Health ───────────────────────────────────────────────────────

dashboardRouter.get('/system/health', async (_req: Request, res: Response) => {
  const health: Record<string, { status: string; latency?: number; info?: string }> = {};

  // Redis
  try {
    const start = Date.now();
    await redis.ping();
    health.redis = { status: 'ok', latency: Date.now() - start };
  } catch {
    health.redis = { status: 'error', info: 'Redis unreachable' };
  }

  // PostgreSQL
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    health.postgres = { status: 'ok', latency: Date.now() - start };
  } catch {
    health.postgres = { status: 'error', info: 'PostgreSQL unreachable' };
  }

  // Crawler
  try {
    const start = Date.now();
    const crawlerUrl = env.CRAWLER_BASE_URL || 'http://crawler:3001';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${crawlerUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    health.crawler = { status: resp.ok ? 'ok' : 'error', latency: Date.now() - start };
  } catch {
    health.crawler = { status: 'error', info: 'Crawler unreachable' };
  }

  const allOk = Object.values(health).every((s) => s.status === 'ok');

  res.status(allOk ? 200 : 503).json({ status: allOk ? 'healthy' : 'degraded', services: health });
});

// ── Cron Runs ───────────────────────────────────────────────────────────

dashboardRouter.get('/system/cron', async (_req: Request, res: Response) => {
  try {
    const runs = await db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(50);
    res.json({ runs });
  } catch (err) {
    logger.error({ err }, 'Dashboard cron runs error');
    res.status(500).json({ error: 'Failed to fetch cron runs' });
  }
});

// ── Job Logs ────────────────────────────────────────────────────────────

dashboardRouter.get('/system/logs', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const queueFilter = req.query.queue as string | undefined;

    const logs = queueFilter
      ? await db.select().from(jobLogs).where(eq(jobLogs.queueName, queueFilter)).orderBy(desc(jobLogs.createdAt)).limit(limit)
      : await db.select().from(jobLogs).orderBy(desc(jobLogs.createdAt)).limit(limit);
    res.json({ logs });
  } catch (err) {
    logger.error({ err }, 'Dashboard logs error');
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ── Recent Webhooks ─────────────────────────────────────────────────────

dashboardRouter.get('/webhooks/recent', async (_req: Request, res: Response) => {
  try {
    const events = await db.select({
      id: webhookEvents.id,
      source: webhookEvents.source,
      event: webhookEvents.event,
      processed: webhookEvents.processed,
      processedAt: webhookEvents.processedAt,
      createdAt: webhookEvents.createdAt,
    }).from(webhookEvents).orderBy(desc(webhookEvents.createdAt)).limit(50);
    res.json({ events });
  } catch (err) {
    logger.error({ err }, 'Dashboard webhooks error');
    res.status(500).json({ error: 'Failed to fetch webhook events' });
  }
});

// ── Competitor Snapshots ────────────────────────────────────────────────

dashboardRouter.get('/competitors', async (_req: Request, res: Response) => {
  try {
    const snapshots = await db.select().from(competitorSnapshots).orderBy(desc(competitorSnapshots.crawledAt)).limit(20);
    res.json({ snapshots });
  } catch (err) {
    logger.error({ err }, 'Dashboard competitors error');
    res.status(500).json({ error: 'Failed to fetch competitor snapshots' });
  }
});

// ── Settings (no admin auth — internal dashboard use) ──────────────────

dashboardRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    const list = await settings.list();
    res.json({ settings: list, configurableKeys: CONFIGURABLE_KEYS });
  } catch (err) {
    logger.error({ err }, 'Dashboard settings list error');
    res.status(500).json({ error: 'Failed to list settings' });
  }
});

dashboardRouter.put('/settings', async (req: Request, res: Response) => {
  const { keys } = req.body as { keys?: Record<string, string | null> };

  if (!keys || typeof keys !== 'object') {
    res.status(400).json({ error: 'Body must contain a "keys" object' });
    return;
  }

  const invalidKeys = Object.keys(keys).filter(
    (k) => !(CONFIGURABLE_KEYS as readonly string[]).includes(k),
  );

  if (invalidKeys.length > 0) {
    res.status(400).json({ error: `Invalid keys: ${invalidKeys.join(', ')}`, validKeys: CONFIGURABLE_KEYS });
    return;
  }

  try {
    await settings.setMany(keys as Partial<Record<ConfigurableKey, string | null>>);
    const updated = Object.keys(keys);
    logger.info({ updated }, 'Dashboard updated settings');
    res.json({ message: `Updated ${updated.length} setting(s)`, updated });
  } catch (err) {
    logger.error({ err }, 'Dashboard settings update error');
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ── Seed Demo Data ──────────────────────────────────────────────────────

dashboardRouter.post('/data/seed', async (_req: Request, res: Response) => {
  try {
    logger.info('Seeding demo data via dashboard');
    const { stdout } = await execAsync('npx tsx scripts/seed-demo.ts', {
      cwd: process.cwd(),
      timeout: 30000,
    });
    logger.info('Demo data seeded successfully');
    res.json({ success: true, output: stdout });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Seed failed';
    logger.error({ err }, 'Dashboard seed error');
    res.status(500).json({ success: false, error: msg });
  }
});

// ── Erase All Seeded Data ───────────────────────────────────────────────

dashboardRouter.post('/data/reset', async (_req: Request, res: Response) => {
  try {
    logger.info('Erasing seeded data via dashboard');

    // Truncate data tables (preserve system_config = user settings)
    await db.delete(jobLogs);
    await db.delete(webhookEvents);
    await db.delete(cronRuns);
    await db.delete(competitorSnapshots);

    // Obliterate all BullMQ queues
    const allQueues = queues.getAll();
    for (const q of allQueues) {
      await q.obliterate({ force: true });
    }

    logger.info('Seeded data erased successfully');
    res.json({ success: true, message: 'All seeded data erased. Settings preserved.' });
  } catch (err) {
    logger.error({ err }, 'Dashboard reset error');
    res.status(500).json({ success: false, error: 'Failed to erase data' });
  }
});

// ── Validate Credentials Per Section ────────────────────────────────────

dashboardRouter.post('/settings/validate', async (req: Request, res: Response) => {
  const { section, values } = req.body as { section: string; values?: Record<string, string> };

  // Resolve effective values: use provided values (only if not masked), fall back to saved settings
  async function resolve(key: ConfigurableKey): Promise<string> {
    const provided = values?.[key];
    // Only use provided value if it exists and isn't a masked placeholder (contains ***)
    if (provided && !provided.includes('***')) return provided;
    return (await settings.get(key)) ?? '';
  }

  try {
    switch (section) {
      case 'woocommerce': {
        const url = await resolve('WOO_URL');
        const ck = await resolve('WOO_CONSUMER_KEY');
        const cs = await resolve('WOO_CONSUMER_SECRET');
        if (!url || !ck || !cs) {
          res.json({ valid: false, message: 'Store URL, Consumer Key, and Consumer Secret are required' });
          return;
        }
        const baseUrl = url.replace(/\/+$/, '');
        const authParams = `consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        // Test with products endpoint (lighter than system_status, proves read access)
        const resp = await fetch(
          `${baseUrl}/wp-json/wc/v3/products?per_page=1&${authParams}`,
          { signal: controller.signal },
        );
        clearTimeout(timeout);
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          res.json({ valid: false, message: `WooCommerce returned ${resp.status}: ${text.slice(0, 200)}` });
          return;
        }
        const products = await resp.json().catch(() => []) as unknown[];
        const totalHeader = resp.headers.get('x-wp-total');
        const productCount = totalHeader ? parseInt(totalHeader, 10) : products.length;
        res.json({ valid: true, message: `Connected — ${productCount} product${productCount !== 1 ? 's' : ''} found in store` });
        return;
      }

      case 'google-sheets': {
        const email = await resolve('GOOGLE_SERVICE_ACCOUNT_EMAIL');
        const sheetId = await resolve('GOOGLE_SHEET_ID');
        if (!email || !sheetId) {
          res.json({ valid: false, message: 'Service Account Email and Sheet ID are required' });
          return;
        }
        // Just verify the service account email format and sheet ID exist
        if (!email.includes('@') || !email.includes('.iam.gserviceaccount.com')) {
          res.json({ valid: false, message: 'Service Account Email must be a valid GCP service account' });
          return;
        }
        res.json({ valid: true, message: 'Google Sheets credentials format looks correct. Full connection test requires the private key.' });
        return;
      }

      case 'whatsapp-meta': {
        const phoneId = await resolve('WHATSAPP_PHONE_NUMBER_ID');
        const token = await resolve('WHATSAPP_ACCESS_TOKEN');
        if (!phoneId || !token) {
          res.json({ valid: false, message: 'Phone Number ID and Access Token are required' });
          return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(
          `https://graph.facebook.com/v21.0/${phoneId}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
        );
        clearTimeout(timeout);
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({})) as Record<string, unknown>;
          const errMsg = (body.error as Record<string, unknown>)?.message ?? `HTTP ${resp.status}`;
          res.json({ valid: false, message: `WhatsApp API: ${errMsg}` });
          return;
        }
        res.json({ valid: true, message: 'WhatsApp Cloud API credentials verified' });
        return;
      }

      case 'email-smtp': {
        const host = await resolve('SMTP_HOST');
        const port = await resolve('SMTP_PORT');
        const user = await resolve('SMTP_USER');
        const pass = await resolve('SMTP_PASS');
        if (!host || !user || !pass) {
          res.json({ valid: false, message: 'Host, User, and Password are required' });
          return;
        }
        const portNum = parseInt(port) || 587;
        const transporter = nodemailer.createTransport({
          host,
          port: portNum,
          secure: portNum === 465,
          auth: { user, pass },
          connectionTimeout: 10000,
        });
        await transporter.verify();
        transporter.close();
        res.json({ valid: true, message: 'SMTP connection verified successfully' });
        return;
      }

      case 'ai': {
        const results: { key: string; valid: boolean; message: string }[] = [];
        const openaiKey = await resolve('OPENAI_API_KEY');
        if (openaiKey) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          try {
            const resp = await fetch('https://api.openai.com/v1/models', {
              headers: { Authorization: `Bearer ${openaiKey}` },
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (resp.ok) {
              results.push({ key: 'OPENAI_API_KEY', valid: true, message: 'OpenAI API key is valid' });
            } else {
              results.push({ key: 'OPENAI_API_KEY', valid: false, message: `OpenAI returned ${resp.status}` });
            }
          } catch (e) {
            clearTimeout(timeout);
            results.push({ key: 'OPENAI_API_KEY', valid: false, message: e instanceof Error ? e.message : 'Connection failed' });
          }
        }
        const geminiKey = await resolve('GEMINI_API_KEY');
        if (geminiKey) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          try {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`, {
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (resp.ok) {
              results.push({ key: 'GEMINI_API_KEY', valid: true, message: 'Gemini API key is valid' });
            } else {
              results.push({ key: 'GEMINI_API_KEY', valid: false, message: `Gemini returned ${resp.status}` });
            }
          } catch (e) {
            clearTimeout(timeout);
            results.push({ key: 'GEMINI_API_KEY', valid: false, message: e instanceof Error ? e.message : 'Connection failed' });
          }
        }
        if (results.length === 0) {
          res.json({ valid: false, message: 'No AI keys configured' });
          return;
        }
        const allValid = results.every((r) => r.valid);
        res.json({ valid: allValid, message: results.map((r) => `${r.key}: ${r.message}`).join('; '), results });
        return;
      }

      case 'social-media': {
        const apiKey = await resolve('POSTIZ_API_KEY');
        const baseUrl = await resolve('POSTIZ_BASE_URL') || 'https://app.postiz.com/api/v1';
        if (!apiKey) {
          res.json({ valid: false, message: 'Postiz API Key is required' });
          return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(`${baseUrl}/posts`, {
          headers: { 'api-key': apiKey },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) {
          res.json({ valid: false, message: `Postiz returned ${resp.status}` });
          return;
        }
        res.json({ valid: true, message: 'Postiz API connection verified' });
        return;
      }

      case 'crawler': {
        const crawlerUrl = await resolve('CRAWLER_BASE_URL') || 'http://localhost:3001';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(`${crawlerUrl}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!resp.ok) {
          res.json({ valid: false, message: `Crawler returned ${resp.status}` });
          return;
        }
        res.json({ valid: true, message: 'Crawler service is reachable' });
        return;
      }

      default:
        res.json({ valid: true, message: 'No validation needed for this section' });
        return;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Validation failed';
    logger.error({ err, section }, 'Settings validation error');
    res.json({ valid: false, message: msg });
  }
});
