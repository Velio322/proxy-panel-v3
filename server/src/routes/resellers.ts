import { Router, Response } from 'express';
import { z } from 'zod';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { AuthRequest, authenticate, requireAdmin, requireReseller } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();
router.use(authenticate);

const createResellerSchema = z.object({
  name: z.string().min(1),
  contactEmail: z.string().email().optional(),
  contactTelegram: z.string().optional(),
  maxClients: z.number().min(1).optional().default(100),
  maxNodes: z.number().min(1).optional().default(5),
  trafficLimit: z.number().min(0).optional(),
  whiteLabel: z.any().optional(),
});

const updateResellerSchema = createResellerSchema.partial();

router.get('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const resellers = await prisma.reseller.findMany({
      include: {
        _count: { select: { users: true, clients: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(serializeBigInt(resellers));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', requireReseller, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();

    // Resellers can only see their own profile
    if (req.user?.role === 'RESELLER' && req.user?.resellerId !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const reseller = await prisma.reseller.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true, clients: true } },
      },
    });
    if (!reseller) return res.status(404).json({ error: 'Reseller not found' });
    res.json(serializeBigInt(reseller));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAdmin, auditLog('CREATE', 'reseller'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = createResellerSchema.parse(req.body);
    const reseller = await prisma.reseller.create({ data });
    res.status(201).json(serializeBigInt(reseller));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireAdmin, auditLog('UPDATE', 'reseller'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = updateResellerSchema.parse(req.body);
    const reseller = await prisma.reseller.update({ where: { id: req.params.id }, data });
    res.json(serializeBigInt(reseller));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAdmin, auditLog('DELETE', 'reseller'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const activeClients = await prisma.client.count({
      where: { resellerId: req.params.id, banned: false },
    });
    if (activeClients > 0) {
      return res.status(400).json({ error: `Cannot delete reseller with ${activeClients} active clients` });
    }
    await prisma.reseller.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reseller dashboard stats
router.get('/:id/stats', requireReseller, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const resellerId = req.params.id;

    if (req.user?.role === 'RESELLER' && req.user?.resellerId !== resellerId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalClients, activeClients, todayTraffic, totalTraffic] = await Promise.all([
      prisma.client.count({ where: { resellerId } }),
      prisma.client.count({ where: { resellerId, banned: false } }),
      prisma.trafficLog.aggregate({
        where: { client: { resellerId }, recordAt: { gte: today } },
        _sum: { upload: true, download: true },
      }),
      prisma.trafficLog.aggregate({
        where: { client: { resellerId } },
        _sum: { upload: true, download: true },
      }),
    ]);

    const reseller = await prisma.reseller.findUnique({ where: { id: resellerId } });

    res.json(serializeBigInt({
      clients: { total: totalClients, active: activeClients },
      traffic: { today: todayTraffic._sum, total: totalTraffic._sum },
      limits: {
        maxClients: reseller?.maxClients || 0,
        trafficLimit: reseller?.trafficLimit || 0,
        usedTraffic: reseller?.usedTraffic || 0,
      },
      balance: reseller?.balance || 0,
    }));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
