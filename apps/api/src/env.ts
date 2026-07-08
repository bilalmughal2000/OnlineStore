// Central env config. Values are loaded via `node --env-file` / `tsx --env-file`.
function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  // PORT is set by Passenger (cPanel "Setup Node.js App"); API_PORT is used by PM2/VPS.
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'postgresql://store:store@localhost:5432/clothing_store'),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
};
