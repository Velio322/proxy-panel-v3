import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { AuthRequest, authenticate, requireAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { getWorkerSocketManager } from '../ws/worker-socket';

const router = Router();
router.use(authenticate);

const createInboundSchema = z.object({
  nodeId: z.string(),
  protocol: z.enum(['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HYSTERIA2', 'NAIVEPROXY', 'MIERU', 'TUIC']),
  tag: z.string(),
  port: z.number().min(1).max(65535),
  listen: z.string().optional().default('0.0.0.0'),
  settings: z.any(),
  stream: z.any().optional().default({}),
  routing: z.any().optional().default({}),
  sniffing: z.boolean().optional().default(true),
  remark: z.string().optional(),
  enable: z.boolean().optional().default(true),
});

const updateInboundSchema = z.object({
  protocol: z.enum(['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HYSTERIA2', 'NAIVEPROXY', 'MIERU', 'TUIC']).optional(),
  tag: z.string().optional(),
  port: z.number().min(1).max(65535).optional(),
  listen: z.string().optional(),
  settings: z.any().optional(),
  stream: z.any().optional(),
  routing: z.any().optional(),
  sniffing: z.boolean().optional(),
  remark: z.string().optional(),
  enable: z.boolean().optional(),
});

const portShareSchema = z.object({
  protocol: z.enum(['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HYSTERIA2', 'NAIVEPROXY', 'MIERU', 'TUIC']),
  tag: z.string(),
  host: z.string().optional(),
  path: z.string().optional(),
  settings: z.any().optional().default({}),
  stream: z.any().optional().default({}),
  enable: z.boolean().optional().default(true),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { nodeId, protocol, search } = req.query as any;

    const where: any = {};
    if (nodeId) where.nodeId = nodeId;
    if (protocol) where.protocol = protocol;
    if (search) {
      where.OR = [
        { tag: { contains: search, mode: 'insensitive' } },
        { remark: { contains: search, mode: 'insensitive' } },
      ];
    }

    const inbounds = await prisma.inbound.findMany({
      where,
      include: { node: { select: { id: true, name: true, host: true } }, portShares: true },
      orderBy: { port: 'asc' },
    });

    res.json(serializeBigInt(inbounds));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/generate-reality-keys', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
    const pubJwk = publicKey.export({ format: 'jwk' });
    const privJwk = privateKey.export({ format: 'jwk' });
    const shortId = crypto.randomBytes(8).toString('hex');

    res.json({
      publicKey: pubJwk.x || '',
      privateKey: privJwk.d || '',
      shortId,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate Reality keys' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const inbound = await prisma.inbound.findUnique({
      where: { id: req.params.id },
      include: { node: { select: { id: true, name: true, host: true } }, portShares: true, clientInbounds: true },
    });
    if (!inbound) return res.status(404).json({ error: 'Inbound not found' });
    res.json(serializeBigInt(inbound));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAdmin, auditLog('CREATE', 'inbound'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = createInboundSchema.parse(req.body);

    const existing = await prisma.inbound.findFirst({
      where: { nodeId: data.nodeId, tag: data.tag },
    });
    if (existing) return res.status(400).json({ error: 'Tag already exists on this node' });

    const inbound = await prisma.inbound.create({ data: data as any });
    
    // Real-time update via WebSocket
    getWorkerSocketManager().pushConfig(data.nodeId);

    res.status(201).json(serializeBigInt(inbound));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireAdmin, auditLog('UPDATE', 'inbound'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = updateInboundSchema.parse(req.body);
    const inbound = await prisma.inbound.update({ where: { id: req.params.id }, data });

    // Real-time update via WebSocket
    getWorkerSocketManager().pushConfig(inbound.nodeId);

    res.json(serializeBigInt(inbound));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAdmin, auditLog('DELETE', 'inbound'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    await prisma.inbound.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/toggle', requireAdmin, auditLog('TOGGLE', 'inbound'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const inbound = await prisma.inbound.findUnique({ where: { id: req.params.id } });
    if (!inbound) return res.status(404).json({ error: 'Inbound not found' });

    const updated = await prisma.inbound.update({
      where: { id: req.params.id },
      data: { enable: !inbound.enable },
    });

    // Real-time update via WebSocket
    getWorkerSocketManager().pushConfig(updated.nodeId);

    res.json({ enable: updated.enable });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── Port-Sharing (SNI Routing) ────

router.post('/:id/port-share', requireAdmin, auditLog('CREATE', 'portShare'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = portShareSchema.parse(req.body);

    const inbound = await prisma.inbound.findUnique({ where: { id: req.params.id } });
    if (!inbound) return res.status(404).json({ error: 'Inbound not found' });

    const portShare = await prisma.portShare.create({
      data: { ...data, inboundId: req.params.id },
    });

    res.status(201).json(serializeBigInt(portShare));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:inboundId/port-share/:id', requireAdmin, auditLog('DELETE', 'portShare'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    await prisma.portShare.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
