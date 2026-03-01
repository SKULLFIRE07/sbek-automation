import { Router, type Request, type Response } from 'express';
import { queues } from '../../queues/registry.js';
import { db } from '../../config/database.js';
import { pool } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { jobLogs, webhookEvents, cronRuns, competitorSnapshots } from '../../db/schema.js';
import { desc, eq } from 'drizzle-orm';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { settings, CONFIGURABLE_KEYS, type ConfigurableKey } from '../../services/settings.service.js';

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
