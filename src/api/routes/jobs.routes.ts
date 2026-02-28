import { Router, type Request, type Response } from 'express';
import { queues } from '../../queues/registry.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

export const jobsRouter = Router();
jobsRouter.use(apiLimiter);

/** List all registered queues and their job counts */
jobsRouter.get('/status', async (_req: Request, res: Response) => {
  const allQueues = queues.getAll();
  const status = await Promise.all(
    allQueues.map(async (q) => {
      const counts = await q.getJobCounts();
      return { name: q.name, ...counts };
    })
  );
  res.json({ queues: status });
});
