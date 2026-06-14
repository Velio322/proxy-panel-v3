import { Router, Response } from 'express';
import { z } from 'zod';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { AuthRequest, authenticate, requireAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { NodeService } from '../services/nodeService';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis';

const router = Router();
router.use(authenticate);

const nodeService = new NodeService();

const createNodeSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().min(1).max(65535).optional().default(443),
  apiPort: z.number().min(1).max(65535).optional().default(2087),
  secret: z.string().min(1),
  country: z.string().optional(),
  city: z.string().optional(),
  isp: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateNodeSchema = z.object({
  name: z.string().min(1).optional(),
  host: z.string().min(1).optional(),
  port: z.number().min(1).max(65535).optional(),
  apiPort: z.number().min(1).max(65535).optional(),
  secret: z.string().min(1).optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  isp: z.string().optional(),
  tags: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { status, search } = req.query as any;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { host: { contains: search, mode: 'insensitive' } },
      ];
    }

    const nodes = await prisma.node.findMany({
      where,
      include: {
        inbounds: {
          select: { id: true, protocol: true, tag: true, enable: true, port: true },
        },
        _count: { select: { inbounds: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(serializeBigInt(nodes));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const node = await prisma.node.findUnique({
      where: { id: req.params.id },
      include: {
        inbounds: true,
        _count: { select: { inbounds: true, trafficLogs: true } },
      },
    });
    if (!node) return res.status(404).json({ error: 'Node not found' });
    res.json(serializeBigInt(node));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAdmin, auditLog('CREATE', 'node'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = createNodeSchema.parse(req.body);
    const node = await prisma.node.create({ data });
    res.status(201).json(node);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireAdmin, auditLog('UPDATE', 'node'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = updateNodeSchema.parse(req.body);
    const node = await prisma.node.update({ where: { id: req.params.id }, data });
    res.json(node);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAdmin, auditLog('DELETE', 'node'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    await prisma.node.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/check', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const status = await nodeService.getNodeStatus(req.params.id);
    res.json(status);
  } catch {
    res.status(500).json({ error: 'Failed to check node status' });
  }
});

router.post('/:id/push-config', requireAdmin, auditLog('PUSH_CONFIG', 'node'), async (req: AuthRequest, res: Response) => {
  try {
    const success = await nodeService.pushConfigToNode(req.params.id);
    res.json({ success });
  } catch {
    res.status(500).json({ error: 'Failed to push config' });
  }
});

router.post('/:id/restart', requireAdmin, auditLog('RESTART', 'node'), async (req: AuthRequest, res: Response) => {
  try {
    const success = await nodeService.restartNode(req.params.id);
    res.json({ success });
  } catch {
    res.status(500).json({ error: 'Failed to restart node' });
  }
});

router.post('/:id/stop', requireAdmin, auditLog('STOP', 'node'), async (req: AuthRequest, res: Response) => {
  try {
    const success = await nodeService.stopNode(req.params.id);
    res.json({ success });
  } catch {
    res.status(500).json({ error: 'Failed to stop node' });
  }
});

router.get('/:id/stats', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { days = '7' } = req.query as any;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const stats = await prisma.trafficLog.groupBy({
      by: ['clientId'],
      where: { nodeId: req.params.id, recordAt: { gte: startDate } },
      _sum: { upload: true, download: true },
    });

    res.json(serializeBigInt(stats));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/inbounds', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const inbounds = await prisma.inbound.findMany({
      where: { nodeId: req.params.id },
      include: { portShares: true },
      orderBy: { port: 'asc' },
    });
    res.json(serializeBigInt(inbounds));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/metrics', async (req: AuthRequest, res: Response) => {
  try {
    const cached = await cacheGet(`node_metrics:${req.params.id}`);
    if (cached) return res.json(cached);

    const node = await nodeService.getNodeStatus(req.params.id);
    await cacheSet(`node_metrics:${req.params.id}`, node, 30);
    res.json(node);
  } catch {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

export default router;
