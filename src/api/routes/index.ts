import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { webhooksRouter } from './webhooks.routes.js';
import { jobsRouter } from './jobs.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { settingsRouter } from './settings.routes.js';

export const router = Router();

// Health checks (no auth, no rate limit)
router.use(healthRouter);

// WooCommerce webhooks
router.use('/webhooks', webhooksRouter);

// Job queue status
router.use('/jobs', jobsRouter);

// Dashboard API (consumed by Next.js frontend)
router.use('/dashboard', dashboardRouter);

// Admin settings with Basic auth (BYOK — Bring Your Own Keys)
router.use('/admin/settings', settingsRouter);
