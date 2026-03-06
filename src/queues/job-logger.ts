import type { Job } from 'bullmq';
import { db } from '../config/database.js';
import { jobLogs } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../config/logger.js';

/**
 * Log a BullMQ job lifecycle event to the job_logs table.
 * Used by worker event handlers so the dashboard "Recent Activity" section has data.
 */
export function logJobActive(queueName: string, job: Job): void {
  db.insert(jobLogs)
    .values({
      queueName,
      jobId: job.id ?? 'unknown',
      status: 'active',
      payload: job.data as Record<string, unknown>,
      attempts: job.attemptsMade,
    })
    .catch((err) => logger.debug({ err }, 'Failed to log job active'));
}

export function logJobCompleted(queueName: string, job: Job, result?: unknown): void {
  // Try to update existing row, else insert
  db.update(jobLogs)
    .set({
      status: 'completed',
      result: (result ?? null) as Record<string, unknown> | null,
      completedAt: new Date(),
      attempts: job.attemptsMade,
    })
    .where(eq(jobLogs.jobId, job.id ?? 'unknown'))
    .then(async (res) => {
      if (res.rowCount === 0) {
        await db.insert(jobLogs).values({
          queueName,
          jobId: job.id ?? 'unknown',
          status: 'completed',
          payload: job.data as Record<string, unknown>,
          result: (result ?? null) as Record<string, unknown> | null,
          completedAt: new Date(),
          attempts: job.attemptsMade,
        });
      }
    })
    .catch((err) => logger.warn({ err, queueName, jobId: job.id }, 'Failed to log job completed'));
}

export function logJobFailed(queueName: string, job: Job | undefined, error: Error): void {
  if (!job) return;
  db.update(jobLogs)
    .set({
      status: 'failed',
      error: error.message,
      completedAt: new Date(),
      attempts: job.attemptsMade,
    })
    .where(eq(jobLogs.jobId, job.id ?? 'unknown'))
    .then(async (res) => {
      if (res.rowCount === 0) {
        await db.insert(jobLogs).values({
          queueName,
          jobId: job.id ?? 'unknown',
          status: 'failed',
          payload: job.data as Record<string, unknown>,
          error: error.message,
          completedAt: new Date(),
          attempts: job.attemptsMade,
        });
      }
    })
    .catch((err) => logger.warn({ err, queueName, jobId: job.id }, 'Failed to log job failed'));
}
