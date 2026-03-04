import { Queue, type QueueOptions } from 'bullmq';
import { env } from '../config/env.js';
import type {
  OrderSyncPayload,
  NotificationPayload,
  ReviewRequestPayload,
  ContentGenerationPayload,
  CreativeGenerationPayload,
  CompetitorCrawlPayload,
} from './types.js';

const SEVEN_DAYS = 7 * 24 * 3600;
const THIRTY_DAYS = 30 * 24 * 3600;

/** Parse REDIS_URL into host/port/password for BullMQ (avoids ioredis version mismatch) */
function redisOpts() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class QueueRegistry {
  private readonly map = new Map<string, Queue<any>>();

  getOrCreate<T>(name: string, opts?: Partial<QueueOptions>): Queue<T> {
    const existing = this.map.get(name);
    if (existing) return existing as Queue<T>;

    const queue = new Queue<T>(name, {
      connection: redisOpts(),
      defaultJobOptions: {
        removeOnComplete: { age: SEVEN_DAYS },
        removeOnFail: { age: THIRTY_DAYS },
        ...opts?.defaultJobOptions,
      },
    });

    this.map.set(name, queue);
    return queue;
  }

  getAll(): Queue[] {
    return [...this.map.values()];
  }

  async closeAll(): Promise<void> {
    await Promise.all(this.getAll().map((q) => q.close()));
    this.map.clear();
  }
}

const registry = new QueueRegistry();

export const orderSync = registry.getOrCreate<OrderSyncPayload>('order-sync', {
  defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 1_000 } },
});

export const notification = registry.getOrCreate<NotificationPayload>('notification', {
  defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 2_000 } },
});

export const reviewRequest = registry.getOrCreate<ReviewRequestPayload>('review-request', {
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
});

export const contentGeneration = registry.getOrCreate<ContentGenerationPayload>('content-generation', {
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
});

export const creativeGeneration = registry.getOrCreate<CreativeGenerationPayload>('creative-generation', {
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 15_000 } },
});

export const competitorCrawl = registry.getOrCreate<CompetitorCrawlPayload>('competitor-crawl', {
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 30_000 } },
});

export const queues = registry;
