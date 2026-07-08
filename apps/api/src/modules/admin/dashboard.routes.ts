import { Router } from 'express';
import { prisma, OrderStatus, PaymentStatus } from '@store/database';
import { asyncHandler } from '../../lib/asyncHandler';
import { serialize } from '../../lib/serialize';
import { toNum } from '../../lib/money';

export const adminDashboardRouter = Router();

// GET /admin/dashboard — KPIs + charts data
adminDashboardRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [orderCount, pendingOrders, customerCount, paidOrders, recentOrders, lowStock, topProducts, byMethod] =
      await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: { in: [OrderStatus.PLACED, OrderStatus.CONFIRMED] } } }),
        prisma.user.count({ where: { role: 'CUSTOMER' } }),
        prisma.order.findMany({
          where: { paymentStatus: PaymentStatus.PAID },
          select: { total: true },
        }),
        prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.productVariant.findMany({
          where: { stock: { lte: 5 } },
          include: { product: { select: { title: true } } },
          take: 10,
          orderBy: { stock: 'asc' },
        }),
        prisma.orderItem.groupBy({
          by: ['productTitle'],
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 5,
        }),
        prisma.order.groupBy({
          by: ['paymentMethod'],
          _count: { _all: true },
        }),
      ]);

    const revenue = paidOrders.reduce((s, o) => s + toNum(o.total), 0);

    // Daily revenue for the last 30 days (from all non-cancelled orders).
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { not: OrderStatus.CANCELLED } },
      select: { total: true, createdAt: true },
    });
    const dailyMap = new Map<string, number>();
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + toNum(o.total));
    }
    const dailyRevenue = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }));

    res.json({
      kpis: {
        totalOrders: orderCount,
        pendingOrders,
        totalCustomers: customerCount,
        paidRevenue: revenue,
        lowStockCount: lowStock.length,
      },
      dailyRevenue,
      recentOrders: serialize(recentOrders),
      lowStock: serialize(lowStock),
      topProducts: topProducts.map((t) => ({ title: t.productTitle, sold: t._sum.quantity ?? 0 })),
      paymentBreakdown: byMethod.map((m) => ({ method: m.paymentMethod, count: m._count._all })),
    });
  }),
);
