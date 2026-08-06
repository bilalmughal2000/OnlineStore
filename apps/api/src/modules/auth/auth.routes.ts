import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '@store/database';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type AuthUser,
} from '@store/shared-types';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimit';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  ttlToMs,
} from '../../lib/jwt';
import { issueTokens, toAuthUser } from '../../lib/session';
import { notifyPasswordReset } from '../../lib/notify';
import { env } from '../../env';
import { badRequest, unauthorized } from '../../lib/errors';
import { z } from 'zod';

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, phone, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw badRequest('An account with this email already exists');

    const user = await prisma.user.create({
      data: { name, email, phone, passwordHash: await bcrypt.hash(password, 10) },
    });
    const tokens = await issueTokens(user.id, 'CUSTOMER');
    res.status(201).json({ user: toAuthUser(user), ...tokens });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw unauthorized('Invalid email or password');
    }
    if (user.isBlocked) throw unauthorized('This account has been blocked');

    const tokens = await issueTokens(user.id, user.role as AuthUser['role']);
    res.json({ user: toAuthUser(user), ...tokens });
  }),
);

authRouter.post(
  '/refresh',
  validate(z.object({ refreshToken: z.string().min(10) })),
  asyncHandler(async (req, res) => {
    const tokenHash = hashToken(req.body.refreshToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw unauthorized('Invalid refresh token');
    }
    // Rotate: revoke the used token, issue a new pair.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await issueTokens(stored.userId, stored.user.role as AuthUser['role']);
    res.json({ user: toAuthUser(stored.user), ...tokens });
  }),
);

authRouter.post(
  '/logout',
  validate(z.object({ refreshToken: z.string().optional() })),
  asyncHandler(async (req, res) => {
    if (req.body.refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(req.body.refreshToken) },
        data: { revokedAt: new Date() },
      });
    }
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) throw unauthorized();
    res.json({ user: toAuthUser(user) });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  validate(
    z.object({
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.auth!.userId },
      data: req.body,
    });
    res.json({ user: toAuthUser(user) });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  validate(z.object({ currentPassword: z.string(), newPassword: z.string().min(8).max(72) })),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user || !(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
      throw badRequest('Current password is incorrect');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(req.body.newPassword, 10) },
    });
    // Revoke all refresh tokens on password change.
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

// Forgot/reset password. The link is emailed via lib/notify, which falls back
// to logging it when SMTP_HOST is unset — so the flow is usable before SMTP is
// configured and starts delivering for real once it is, with no code change.
authRouter.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (user) {
      const { token, tokenHash } = generateRefreshToken();
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: `reset:${tokenHash}`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      // Never log the raw token: server logs are visible to anyone with access
      // to the platform, and the token is enough to take over the account.
      notifyPasswordReset(user.email, user.name, token);
    }
    // Always return ok to avoid leaking which emails exist.
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const tokenHash = `reset:${hashToken(req.body.token)}`;
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw badRequest('Invalid or expired reset token');
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash: await bcrypt.hash(req.body.password, 10) },
      }),
      // Sign out everywhere. If the account was compromised, changing the
      // password has to end the attacker's session too — otherwise their
      // existing refresh token keeps working and the reset achieves nothing.
      prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    res.json({ ok: true });
  }),
);
