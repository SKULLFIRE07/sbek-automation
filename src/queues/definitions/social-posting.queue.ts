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
 * Optimal posting times (IST) per platform based on jewelry/luxury audience data.
 * Returns an ISO date string for the next optimal posting slot.
 */
function getOptimalPostingTime(platform: string): string {
  // Optimal hours in IST (UTC+5:30) for luxury jewelry audience
  const optimalHours: Record<string, number[]> = {
    instagram: [10, 14, 19],   // 10 AM, 2 PM, 7 PM IST
    facebook: [9, 13, 17],     // 9 AM, 1 PM, 5 PM IST
    linkedin: [8, 12, 17],     // 8 AM, 12 PM, 5 PM IST
    twitter: [9, 12, 18],      // 9 AM, 12 PM, 6 PM IST
    pinterest: [14, 20, 21],   // 2 PM, 8 PM, 9 PM IST
  };

  const hours = optimalHours[platform] ?? [10, 14, 19];
  const now = new Date();

  // IST offset: UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const currentHour = istNow.getUTCHours();

  // Find the next optimal hour that hasn't passed today
  let targetHour = hours.find((h) => h > currentHour);

  const scheduled = new Date(istNow);
  if (targetHour !== undefined) {
    // Schedule today at the optimal hour
    scheduled.setUTCHours(targetHour, 0, 0, 0);
  } else {
    // All optimal times have passed today — schedule for tomorrow's first slot
    scheduled.setUTCDate(scheduled.getUTCDate() + 1);
    scheduled.setUTCHours(hours[0], 0, 0, 0);
  }

  // Convert back from IST to UTC
  const utcScheduled = new Date(scheduled.getTime() - istOffset);
  return utcScheduled.toISOString();
}

/**
 * Social Posting Worker — uploads media and creates draft posts via Postiz.
 * Supports Instagram, Facebook, LinkedIn, Twitter/X, and Pinterest.
 * Concurrency: 1.
 */
export const socialPostingWorker = new Worker<SocialPostingPayload>(
  'social-posting',
  async (job: Job<SocialPostingPayload>) => {
    const { platform, imageUrl, caption, productName, scheduledFor, useOptimalTime } = job.data;

    logger.info(
      { jobId: job.id, platform, productName, scheduled: !!scheduledFor, useOptimalTime },
      'Processing social posting',
    );

    // 1. Upload media to Postiz
    const filename = `${productName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.jpg`;
    const mediaId = await postiz.uploadMedia(imageUrl, filename);

    // 2. Determine target platforms
    const ALL_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'twitter', 'pinterest'];
    const platforms = platform === 'all' ? ALL_PLATFORMS : [platform];

    // 3. Determine scheduling time
    let scheduleTime = scheduledFor;
    if (!scheduleTime && useOptimalTime) {
      // Use the optimal time for the primary platform
      scheduleTime = getOptimalPostingTime(platforms[0]);
      logger.info(
        { platform: platforms[0], scheduledAt: scheduleTime },
        'AI-suggested optimal posting time selected',
      );
    }

    // 4. Create the post in Postiz
    const postId = await postiz.createPost({
      content: caption,
      mediaIds: [mediaId],
      platforms,
      scheduledAt: scheduleTime,
    });

    logger.info(
      { jobId: job.id, postId, mediaId, platforms, scheduledAt: scheduleTime },
      'Social post created in Postiz',
    );

    return { postId, mediaId, platforms, scheduledAt: scheduleTime };
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
