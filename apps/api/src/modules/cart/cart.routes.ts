import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@store/database';
import { addToCartSchema, updateCartItemSchema } from '@store/shared-types';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { badRequest, notFound } from '../../lib/errors';
import { priceCart } from '../orders/pricing';
import { resolveCart, mergeGuestCart } from './cart.service';

export const cartRouter = Router();

// All cart routes work for guests (via x-guest-id) or logged-in users.
cartRouter.use(optionalAuth);

async function respondWithCart(cartId: string, res: import('express').Response, couponCode?: string) {
  const items = await prisma.cartItem.findMany({ where: { cartId } });
  const pricing = await priceCart(
    items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    { couponCode },
  );
  res.json({ cartId, ...pricing });
}

// GET /cart
cartRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await resolveCart(req);
    await respondWithCart(cart.id, res, req.query.coupon ? String(req.query.coupon) : undefined);
  }),
);

// POST /cart/items — add item (validates stock)
cartRouter.post(
  '/items',
  validate(addToCartSchema),
  asyncHandler(async (req, res) => {
    const cart = await resolveCart(req);
    const variant = await prisma.productVariant.findUnique({ where: { id: req.body.variantId } });
    if (!variant) throw notFound('Product variant not found');

    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
    });
    const nextQty = (existing?.quantity ?? 0) + req.body.quantity;
    if (nextQty > variant.stock) throw badRequest(`Only ${variant.stock} in stock`);

    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
      update: { quantity: nextQty },
      create: { cartId: cart.id, variantId: variant.id, quantity: req.body.quantity },
    });
    await respondWithCart(cart.id, res);
  }),
);

// PATCH /cart/items/:variantId — set quantity (0 removes)
cartRouter.patch(
  '/items/:variantId',
  validate(updateCartItemSchema),
  asyncHandler(async (req, res) => {
    const cart = await resolveCart(req);
    const { quantity } = req.body;
    if (quantity === 0) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId: req.params.variantId } });
    } else {
      const variant = await prisma.productVariant.findUnique({ where: { id: req.params.variantId } });
      if (!variant) throw notFound('Variant not found');
      if (quantity > variant.stock) throw badRequest(`Only ${variant.stock} in stock`);
      await prisma.cartItem.update({
        where: { cartId_variantId: { cartId: cart.id, variantId: req.params.variantId } },
        data: { quantity },
      });
    }
    await respondWithCart(cart.id, res);
  }),
);

// DELETE /cart/items/:variantId
cartRouter.delete(
  '/items/:variantId',
  asyncHandler(async (req, res) => {
    const cart = await resolveCart(req);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId: req.params.variantId } });
    await respondWithCart(cart.id, res);
  }),
);

// DELETE /cart — clear
cartRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await resolveCart(req);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await respondWithCart(cart.id, res);
  }),
);

// POST /cart/merge — merge guest cart into user cart on login
cartRouter.post(
  '/merge',
  requireAuth,
  validate(z.object({ guestSessionId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    await mergeGuestCart(req.auth!.userId, req.body.guestSessionId);
    const cart = await resolveCart(req);
    await respondWithCart(cart.id, res);
  }),
);
