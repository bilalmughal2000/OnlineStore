import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { forbidden, unauthorized } from '../lib/errors';

export interface AuthContext {
  userId: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
      guestId?: string;
    }
  }
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

// Attaches req.auth if a valid token is present; never throws.
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.auth = { userId: payload.sub, role: payload.role };
    } catch {
      /* ignore invalid token for optional auth */
    }
  }
  // Guest cart identity via header (set by client, persisted in localStorage).
  const guest = req.headers['x-guest-id'];
  if (typeof guest === 'string' && guest) req.guestId = guest;
  next();
}

// Requires a valid access token.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return next(unauthorized('Authentication required'));
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

// Requires one of the given roles (implies requireAuth).
export function requireRole(...roles: Array<'CUSTOMER' | 'STAFF' | 'ADMIN'>) {
  return [
    requireAuth,
    (req: Request, _res: Response, next: NextFunction) => {
      if (!req.auth || !roles.includes(req.auth.role)) return next(forbidden());
      next();
    },
  ];
}
