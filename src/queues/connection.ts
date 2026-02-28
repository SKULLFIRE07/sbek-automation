import Redis from 'ioredis';
import { env } from '../config/env.js';

/**
 * Create a new Redis connection configured for BullMQ.
 * Each worker / queue should own its own connection.
 */
export function createRedisConnection(): Redis {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  connection.on('error', (err: Error) => {
    console.error('[queues/redis] Connection error:', err);
  });

  return connection;
}

/** Shared default connection for queue producers (adding jobs). */
const connection: Redis = createRedisConnection();
export default connection;
