import { prisma } from '@store/database';
import type { AuthUser } from '@store/shared-types';
import { generateRefreshToken, signAccessToken, ttlToMs } from './jwt';
import { env } from '../env';

/**
 * Session issuing, shared by every route that can start one: register, login,
 * and claiming a guest order (which creates an account and signs the buyer in
 * straight away). Kept in one place so the refresh-token lifetime and hashing
 * can never drift between them.
 */

export function toAuthUser(u: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
}): AuthUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role as AuthUser['role'],
  };
}

export async function issueTokens(userId: string, role: AuthUser['role']) {
  const accessToken = signAccessToken({ sub: userId, role });
  const { token: refreshToken, tokenHash } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + ttlToMs(env.jwt.refreshTtl)),
    },
  });
  return { accessToken, refreshToken };
}
