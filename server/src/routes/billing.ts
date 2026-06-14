import { Router, Response } from 'express';
import { z } from 'zod';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { AuthRequest, authenticate, requireAdmin, requireReseller } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { createAuditLog } from '../lib/audit';

const router = Router();
router.use(authenticate);

// List invoices
router.get('/invoices', requireReseller, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { status, page = '1', limit = '20' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {};
    if (status) where.status = status;

    if (req.user?.role === 'RESELLER') {
      where.resellerId = req.user.resellerId;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { plan: { select: { id: true, name: true } }, reseller: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json(serializeBigInt({
      data: invoices,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    }));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create invoice (admin creates for reseller, or reseller creates for client purchase)
router.post('/invoices', requireReseller, auditLog('CREATE', 'invoice'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { resellerId, planId, amount, currency, paymentMethod, expiresAt } = req.body;

    let targetResellerId = resellerId;
    if (req.user?.role === 'RESELLER') {
      targetResellerId = req.user.resellerId;
    }

    if (!targetResellerId) {
      return res.status(400).json({ error: 'Reseller ID required' });
    }

    const invoice = await prisma.invoice.create({
      data: {
        resellerId: targetResellerId,
        planId,
        amount,
        currency: currency || 'USD',
        paymentMethod,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
      include: { plan: { select: { name: true } } },
    });

    res.status(201).json(serializeBigInt(invoice));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark invoice as paid
router.post('/invoices/:id/pay', requireAdmin, auditLog('PAY', 'invoice'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { paymentId } = req.body;

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        status: 'PAID',
        paymentId,
        paidAt: new Date(),
      },
    });

    // If plan attached, create/update subscription
    if (invoice.planId && invoice.resellerId) {
      const plan = await prisma.plan.findUnique({ where: { id: invoice.planId } });
      if (plan) {
        await prisma.reseller.update({
          where: { id: invoice.resellerId },
          data: { planId: plan.id },
        });
      }
    }

    res.json(serializeBigInt(invoice));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Orders (client-facing)
router.get('/orders', requireReseller, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { status, clientId } = req.query as any;

    const where: any = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;

    const orders = await prisma.order.findMany({
      where,
      include: { plan: { select: { id: true, name: true, price: true } }, client: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(serializeBigInt(orders));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create order (client purchases a plan)
router.post('/orders', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { clientId, planId, paymentMethod } = req.body;

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const order = await prisma.order.create({
      data: {
        clientId,
        planId,
        amount: plan.price,
        currency: plan.currency,
        paymentMethod,
      },
      include: { plan: { select: { name: true, price: true } } },
    });

    res.status(201).json(serializeBigInt(order));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete order (payment callback)
router.post('/orders/:id/complete', auditLog('COMPLETE', 'order'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { paymentId } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { plan: true, client: true },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'PENDING') return res.status(400).json({ error: 'Order already processed' });

    // Create or extend subscription
    const now = new Date();
    const expireAt = new Date(now.getTime() + order.plan.duration * 86400000);

    await prisma.$transaction([
      prisma.order.update({
        where: { id: req.params.id },
        data: { status: 'COMPLETED', paymentId, paymentMethod: req.body.paymentMethod },
      }),
      prisma.subscription.create({
        data: {
          clientId: order.clientId,
          planId: order.planId,
          resellerId: order.client.resellerId,
          startAt: now,
          expireAt,
          trafficLimit: order.plan.trafficLimit,
        },
      }),
      prisma.client.update({
        where: { id: order.clientId },
        data: {
          expireAt,
          trafficLimit: order.plan.trafficLimit,
        },
      }),
    ]);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revenue stats
router.get('/revenue', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { days = '30' } = req.query as any;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const revenue = await prisma.$queryRaw`
      SELECT
        date_trunc('day', "createdAt") as day,
        SUM("amount") as total,
        COUNT(*) as count
      FROM "Invoice"
      WHERE "status" = 'PAID' AND "paidAt" >= ${startDate}
      GROUP BY date_trunc('day', "createdAt")
      ORDER BY day ASC
    `;

    const totalRevenue = await prisma.invoice.aggregate({
      where: { status: 'PAID', paidAt: { gte: startDate } },
      _sum: { amount: true },
      _count: { id: true },
    });

    res.json(serializeBigInt({
      daily: revenue,
      total: totalRevenue._sum.amount || 0,
      count: totalRevenue._count.id,
    }));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
