import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { AuthRequest, authenticate, requireAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { cacheInvalidatePattern } from '../lib/redis';
import { createAuditLog } from '../lib/audit';

const router = Router();
router.use(authenticate);

const createClientSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  trafficLimit: z.number().min(0).optional(),
  expireAt: z.string().datetime().optional(),
  note: z.string().optional(),
  protocols: z.array(z.string()).optional(),
  resellerId: z.string().optional(),
});

const updateClientSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  trafficLimit: z.number().min(0).optional(),
  expireAt: z.string().datetime().optional(),
  banned: z.boolean().optional(),
  note: z.string().optional(),
  protocols: z.array(z.string()).optional(),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { search, page = '1', limit = '20', resellerId, banned, sort = 'createdAt', order = 'desc' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { uuid: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (resellerId) where.resellerId = resellerId;
    if (banned !== undefined) where.banned = banned === 'true';

    // Resellers see only their own clients
    if (req.user?.role === 'RESELLER') {
      where.resellerId = req.user.resellerId;
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: { settings: true, reseller: { select: { id: true, name: true } } },
        skip, take,
        orderBy: { [sort]: order },
      }),
      prisma.client.count({ where }),
    ]);

    res.json(serializeBigInt({
      data: clients.map((c) => ({ ...c, password: undefined })),
      total,
      page: parseInt(page),
      pages: Math.ceil(total / take),
      limit: take,
    }));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { settings: true, reseller: { select: { id: true, name: true } } },
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(serializeBigInt({ ...client, password: undefined }));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAdmin, auditLog('CREATE', 'client'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = createClientSchema.parse(req.body);

    const existing = await prisma.client.findFirst({
      where: { username: data.username, resellerId: data.resellerId || null },
    });
    if (existing) return res.status(400).json({ error: 'Username already exists for this reseller' });

    const clientUuid = uuidv4();
    const subToken = uuidv4();
    const password = data.password || uuidv4().replace(/-/g, '').substring(0, 16);
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine resellerId
    let resellerId = data.resellerId;
    if (req.user?.role === 'RESELLER') {
      resellerId = req.user.resellerId;
    }

    const client = await prisma.client.create({
      data: {
        uuid: clientUuid,
        username: data.username,
        email: data.email,
        password: hashedPassword,
        trafficLimit: data.trafficLimit || 0,
        expireAt: data.expireAt ? new Date(data.expireAt) : null,
        note: data.note,
        subToken,
        protocols: data.protocols || ['VLESS', 'HYSTERIA2'],
        resellerId,
        settings: {
          create: {
            subId: uuidv4(),
            subPath: `/api/v1/client/${subToken}/sub`,
          },
        },
      },
      include: { settings: true },
    });

    res.status(201).json(serializeBigInt({
      ...client,
      password: data.password || password,
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireAdmin, auditLog('UPDATE', 'client'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = updateClientSchema.parse(req.body);
    const updateData: any = { ...data };

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    if (data.expireAt) {
      updateData.expireAt = new Date(data.expireAt);
    }

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: updateData,
      include: { settings: true },
    });

    await cacheInvalidatePattern(`sub:${req.params.id}*`);
    res.json(serializeBigInt({ ...client, password: undefined }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAdmin, auditLog('DELETE', 'client'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    await prisma.client.delete({ where: { id: req.params.id } });
    await cacheInvalidatePattern(`sub:${req.params.id}*`);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/reset-traffic', requireAdmin, auditLog('RESET_TRAFFIC', 'client'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    await prisma.client.update({
      where: { id: req.params.id },
      data: { usedTraffic: 0, uploadTraffic: 0, downloadTraffic: 0 },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/toggle-ban', requireAdmin, auditLog('TOGGLE_BAN', 'client'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const updated = await prisma.client.update({
      where: { id: req.params.id },
      data: { banned: !client.banned },
    });

    res.json({ banned: updated.banned });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/stats', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { days = '7' } = req.query as any;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const stats = await prisma.trafficLog.groupBy({
      by: ['nodeId'],
      where: {
        clientId: req.params.id,
        recordAt: { gte: startDate },
      },
      _sum: { upload: true, download: true },
    });

    res.json(serializeBigInt(stats));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/traffic-daily', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { days = '30' } = req.query as any;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const logs = await prisma.$queryRaw`
      SELECT
        date_trunc('day', "recordAt") as day,
        SUM("upload") as upload,
        SUM("download") as download
      FROM "TrafficLog"
      WHERE "clientId" = ${req.params.id}
        AND "recordAt" >= ${startDate}
      GROUP BY date_trunc('day', "recordAt")
      ORDER BY day ASC
    `;

    res.json(serializeBigInt(logs));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
