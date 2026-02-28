import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { webhooksRouter } from './webhooks.routes.js';
import { jobsRouter } from './jobs.routes.js';

export const router = Router();

// Health checks (no auth, no rate limit)
router.use(healthRouter);

// WooCommerce webhooks
router.use('/webhooks', webhooksRouter);

// Job queue status
router.use('/jobs', jobsRouter);

// Future route modules:
// router.use('/content', contentRouter);
// router.use('/creative', creativeRouter);
// router.use('/social', socialRouter);
