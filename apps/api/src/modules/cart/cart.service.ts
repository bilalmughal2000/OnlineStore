import { prisma } from '@store/database';
import type { Request } from 'express';
import { badRequest } from '../../lib/errors';

// Resolve (or create) the cart for the current requester — logged-in user or guest.
export async function resolveCart(req: Request) {
  if (req.auth?.userId) {
    const existing = await prisma.cart.findUnique({
      where: { userId: req.auth.userId },
      include: cartInclude,
    });
    if (existing) return existing;
    return prisma.cart.create({ data: { userId: req.auth.userId }, include: cartInclude });
  }

  const guestId = req.guestId;
  if (!guestId) throw badRequest('Missing guest session id (x-guest-id header)');
  const existing = await prisma.cart.findUnique({
    where: { guestSessionId: guestId },
    include: cartInclude,
  });
  if (existing) return existing;
  return prisma.cart.create({ data: { guestSessionId: guestId }, include: cartInclude });
}

export const cartInclude = {
  items: {
    include: {
      variant: {
        include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
      },
    },
  },
} as const;

/**
 * Merge a guest cart into the user's cart on login, then delete the guest cart.
 * Called from the cart merge endpoint after authentication.
 */
export async function mergeGuestCart(userId: string, guestSessionId: string) {
  const guestCart = await prisma.cart.findUnique({
    where: { guestSessionId },
    include: { items: true },
  });
  if (!guestCart || guestCart.items.length === 0) return;

  const userCart =
    (await prisma.cart.findUnique({ where: { userId } })) ??
    (await prisma.cart.create({ data: { userId } }));

  for (const item of guestCart.items) {
    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
      update: { quantity: { increment: item.quantity } },
      create: { cartId: userCart.id, variantId: item.variantId, quantity: item.quantity },
    });
  }
  await prisma.cart.delete({ where: { id: guestCart.id } });
}
