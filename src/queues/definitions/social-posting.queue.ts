import { Worker, type Job } from 'bullmq';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { SocialPostingPayload } from '../types.js';
import { postiz } from '../../services/postiz.service.js';

/** Parse REDIS_URL for BullMQ worker connection */
function redisOpts() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

/**
 * Social Posting Worker — uploads media and creates draft posts via Postiz.
 * Concurrency: 1.
 */
export const socialPostingWorker = new Worker<SocialPostingPayload>(
  'social-posting',
  async (job: Job<SocialPostingPayload>) => {
    const { platform, imageUrl, caption, productName, scheduledFor } = job.data;

    logger.info(
      { jobId: job.id, platform, productName, scheduled: !!scheduledFor },
      'Processing social posting',
    );

    // 1. Upload media to Postiz
    const filename = `${productName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.jpg`;
    const mediaId = await postiz.uploadMedia(imageUrl, filename);

    // 2. Determine target platforms
    const platforms = platform === 'all'
      ? ['instagram', 'facebook']
      : [platform];

    // 3. Create the draft post in Postiz
    const postId = await postiz.createPost({
      content: caption,
      mediaIds: [mediaId],
      platforms,
      scheduledAt: scheduledFor,
    });

    logger.info(
      { jobId: job.id, postId, mediaId, platforms },
      'Social post created in Postiz',
    );

    return { postId, mediaId };
  },
  {
    connection: redisOpts(),
    concurrency: 1,
  },
);

socialPostingWorker.on('completed', (job) => {
  logger.info(
    { jobId: job.id, productName: job.data.productName },
    'Social posting completed',
  );
});

socialPostingWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, productName: job?.data.productName, err: err.message },
    'Social posting failed',
  );
});
