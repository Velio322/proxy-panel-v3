import { Router, Response } from 'express';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { AuthRequest, authenticate } from '../middleware/auth';
import { cacheGet, cacheSet } from '../lib/redis';

const router = Router();
router.use(authenticate);

router.get('/overview', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const cacheKey = `dashboard:overview:${req.user?.role}:${req.user?.resellerId || 'all'}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const where: any = {};
    if (req.user?.role === 'RESELLER') {
      where.resellerId = req.user.resellerId;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalClients,
      activeClients,
      bannedClients,
      totalNodes,
      onlineNodes,
      totalInbounds,
      activeSubscriptions,
      expiringToday,
      todayTraffic,
      monthTraffic,
    ] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.count({ where: { ...where, banned: false, expireAt: { gt: now } } }),
      prisma.client.count({ where: { ...where, banned: true } }),
      prisma.node.count({ where: { active: true } }),
      prisma.node.count({ where: { status: 'ONLINE', active: true } }),
      prisma.inbound.count({ where: { enable: true } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', ...where } }),
      prisma.client.count({
        where: {
          ...where,
          expireAt: { gte: today, lte: new Date(today.getTime() + 86400000) },
        },
      }),
      prisma.trafficLog.aggregate({
        where: { recordAt: { gte: today } },
        _sum: { upload: true, download: true },
      }),
      prisma.trafficLog.aggregate({
        where: { recordAt: { gte: thisMonth } },
        _sum: { upload: true, download: true },
      }),
    ]);

    const result = {
      clients: { total: totalClients, active: activeClients, banned: bannedClients },
      nodes: { total: totalNodes, online: onlineNodes, offline: totalNodes - onlineNodes },
      inbounds: { total: totalInbounds },
      subscriptions: { active: activeSubscriptions, expiringToday },
      traffic: {
        today: { upload: todayTraffic._sum.upload || 0, download: todayTraffic._sum.download || 0 },
        month: { upload: monthTraffic._sum.upload || 0, download: monthTraffic._sum.download || 0 },
      },
    };

    await cacheSet(cacheKey, serializeBigInt(result), 60);
    res.json(serializeBigInt(result));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/traffic-chart', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { days = '7', nodeId, clientId } = req.query as any;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const where: any = { recordAt: { gte: startDate } };
    if (nodeId) where.nodeId = nodeId;
    if (clientId) where.clientId = clientId;

    const data = await prisma.$queryRaw`
      SELECT
        date_trunc('day', "recordAt") as day,
        SUM("upload") as upload,
        SUM("download") as download
      FROM "TrafficLog"
      WHERE "recordAt" >= ${startDate}
        ${nodeId ? prisma.$queryRaw`AND "nodeId" = ${nodeId}` : prisma.$queryRaw``}
        ${clientId ? prisma.$queryRaw`AND "clientId" = ${clientId}` : prisma.$queryRaw``}
      GROUP BY date_trunc('day', "recordAt")
      ORDER BY day ASC
    `;

    res.json(serializeBigInt(data));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/top-clients', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { days = '7', limit = '10' } = req.query as any;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const topClients = await prisma.trafficLog.groupBy({
      by: ['clientId'],
      where: { recordAt: { gte: startDate } },
      _sum: { upload: true, download: true },
      orderBy: { _sum: { download: 'desc' } },
      take: parseInt(limit),
    });

    const clientIds = topClients.map((t) => t.clientId);
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, username: true, uuid: true },
    });

    const result = topClients.map((t) => ({
      ...t,
      client: clients.find((c) => c.id === t.clientId),
    }));

    res.json(serializeBigInt(result));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/recent-audit', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { limit = '20' } = req.query as any;

    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { id: true, username: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    res.json(serializeBigInt(logs));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
