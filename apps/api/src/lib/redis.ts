import Redis from 'ioredis';
import { env } from '../env';

// Lazy Redis client. Used for rate-limiting counters and guest-cart hints.
// The app degrades gracefully if Redis is unavailable.
let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    client.on('error', (err) => {
      // Avoid crashing the process on transient Redis errors.
      if (process.env.NODE_ENV !== 'test') console.warn('[redis]', err.message);
    });
  }
  return client;
}
