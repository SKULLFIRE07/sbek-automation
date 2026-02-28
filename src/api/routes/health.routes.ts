import { Router } from 'express';
import { redis } from '../../config/redis.js';
import { pool } from '../../config/database.js';
import { logger } from '../../config/logger.js';

export const healthRouter = Router();

/** Basic liveness check */
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** Deep readiness check — verifies Redis + PostgreSQL connections */
healthRouter.get('/health/ready', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    checks.redis = 'error';
  }

  try {
    await pool.query('SELECT 1');
    checks.postgres = 'ok';
  } catch (err) {
    logger.error({ err }, 'Postgres health check failed');
    checks.postgres = 'error';
  }

  const allHealthy = Object.values(checks).every((v) => v === 'ok');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});
