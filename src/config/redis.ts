import Redis from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
});

redis.on('error', (err: Error) => {
  console.error('[redis] Connection error:', err);
});
