import { getRedis } from './redis';

// Cache keys are namespaced by a global version counter. Any admin write bumps
// the version (see admin router), which instantly invalidates all cached reads
// without needing pattern deletes. Everything here fails open: if Redis is
// unavailable the underlying function still runs and its errors propagate.
const VERSION_KEY = 'store:cacheVersion';

async function versionedKey(redis: ReturnType<typeof getRedis>, key: string): Promise<string | null> {
  try {
    const v = (await redis.get(VERSION_KEY)) ?? '1';
    return `cache:v${v}:${key}`;
  } catch {
    return null; // Redis down — skip caching entirely
  }
}

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  const cacheKey = await versionedKey(redis, key);

  if (cacheKey) {
    try {
      const hit = await redis.get(cacheKey);
      if (hit) return JSON.parse(hit) as T;
    } catch {
      /* fall through to compute */
    }
  }

  const value = await fn(); // real errors propagate (runs exactly once)

  if (cacheKey) {
    redis.set(cacheKey, JSON.stringify(value), 'EX', ttlSeconds).catch(() => {});
  }
  return value;
}

// Invalidate all cached reads by bumping the namespace version.
export function bumpCacheVersion(): void {
  getRedis()
    .incr(VERSION_KEY)
    .catch(() => {});
}
