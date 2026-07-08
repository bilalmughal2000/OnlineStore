import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../env';

export interface AccessPayload {
  sub: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessPayload;
}

// Refresh tokens are opaque random strings; only their hash is stored in the DB.
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Parse a TTL like "30d" / "15m" into milliseconds for cookie/DB expiry.
export function ttlToMs(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) return 0;
  const n = Number(m[1]);
  return n * { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd'];
}
