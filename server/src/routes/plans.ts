import { Router, Response } from 'express';
import { z } from 'zod';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { AuthRequest, authenticate, requireAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();
router.use(authenticate);

const createPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['USER', 'RESELLER']).optional().default('USER'),
  price: z.number().min(0),
  currency: z.string().optional().default('USD'),
  duration: z.number().min(1),
  trafficLimit: z.number().min(0),
  maxClients: z.number().min(1).optional(),
  maxSpeed: z.number().min(1).optional(),
  protocols: z.array(z.string()).optional(),
  features: z.any().optional(),
  resellerId: z.string().optional(),
});

const updatePlanSchema = createPlanSchema.partial();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { type, active } = req.query as any;

    const where: any = {};
    if (type) where.type = type;
    if (active !== undefined) where.active = active === 'true';

    const plans = await prisma.plan.findMany({
      where,
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { sortOrder: 'asc' },
    });

    res.json(serializeBigInt(plans));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const plan = await prisma.plan.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { subscriptions: true, invoices: true } } },
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(serializeBigInt(plan));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAdmin, auditLog('CREATE', 'plan'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = createPlanSchema.parse(req.body);
    const plan = await prisma.plan.create({ data });
    res.status(201).json(serializeBigInt(plan));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireAdmin, auditLog('UPDATE', 'plan'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = updatePlanSchema.parse(req.body);
    const plan = await prisma.plan.update({ where: { id: req.params.id }, data });
    res.json(serializeBigInt(plan));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAdmin, auditLog('DELETE', 'plan'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const activeSubs = await prisma.subscription.count({
      where: { planId: req.params.id, status: 'ACTIVE' },
    });
    if (activeSubs > 0) {
      return res.status(400).json({ error: `Cannot delete plan with ${activeSubs} active subscriptions` });
    }
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get plans available for purchase (public)
router.get('/public/available', async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const plans = await prisma.plan.findMany({
      where: { active: true, type: 'USER' },
      select: {
        id: true, name: true, description: true, price: true,
        currency: true, duration: true, trafficLimit: true,
        maxSpeed: true, protocols: true, features: true,
      },
      orderBy: { price: 'asc' },
    });
    res.json(serializeBigInt(plans));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

import { Request } from 'express';

export default router;
