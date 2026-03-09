import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { webhooksRouter } from './webhooks.routes.js';
import { jobsRouter } from './jobs.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { settingsRouter } from './settings.routes.js';
import { authRouter } from './auth.routes.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';

export const router = Router();

// Health checks (no auth, no rate limit)
router.use(healthRouter);

// WooCommerce webhooks
router.use('/webhooks', webhooksRouter);

// Job queue status (admin only)
router.use('/jobs', requireAdminAuth, jobsRouter);

// Dashboard API — admin auth required (contains PII, API key reveal, queue controls)
router.use('/dashboard', requireAdminAuth, dashboardRouter);

// Admin settings with Basic auth (BYOK — Bring Your Own Keys)
router.use('/admin/settings', settingsRouter);

// Google OAuth flow — no admin auth on authorize/callback (Google redirects here)
// Disconnect route still requires admin auth (handled inside authRouter)
router.use('/auth', authRouter);
