import Redis from 'ioredis';
import { env } from '../env';

// Redis is optional. Enabled only when REDIS_URL is configured — on hosts
// without Redis (e.g. shared cPanel) leave it unset and caching is skipped
// cleanly (no connection retries / error spam).
export const REDIS_ENABLED = Boolean(env.redisUrl);

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
