import { Router, Response } from 'express';
import { z } from 'zod';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { AuthRequest, authenticate, requireAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();
router.use(authenticate);

// ──── Validation Schemas ────

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  priority: z.number().int().min(0).optional().default(0),
  type: z.enum(['field', 'logical']).optional().default('field'),
  domain: z.array(z.string()).optional().default([]),
  ip: z.array(z.string()).optional().default([]),
  port: z.string().optional(),
  sourcePort: z.string().optional(),
  source: z.array(z.string()).optional().default([]),
  protocol: z.array(z.string()).optional().default([]),
  inboundTag: z.array(z.string()).optional().default([]),
  outboundTag: z.string().optional().default('direct'),
  balancerTag: z.string().optional(),
  subRules: z.any().optional(),
  nodeScope: z.string().nullable().optional(),
});

const updateRuleSchema = createRuleSchema.partial();

// ──── GET /api/routing — List all rules ────

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { nodeScope, enabled, outboundTag } = req.query as any;

    const where: any = {};
    if (nodeScope !== undefined) where.nodeScope = nodeScope === 'null' ? null : nodeScope;
    if (enabled !== undefined) where.enabled = enabled === 'true';
    if (outboundTag) where.outboundTag = outboundTag;

    const rules = await prisma.routingRule.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    res.json(serializeBigInt(rules));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── GET /api/routing/:id — Get single rule ────

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const rule = await prisma.routingRule.findUnique({
      where: { id: req.params.id },
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(serializeBigInt(rule));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── POST /api/routing — Create rule ────

router.post('/', requireAdmin, auditLog('CREATE', 'routing_rule'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = createRuleSchema.parse(req.body);

    const rule = await prisma.routingRule.create({ data });
    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── PUT /api/routing/:id — Update rule ────

router.put('/:id', requireAdmin, auditLog('UPDATE', 'routing_rule'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = updateRuleSchema.parse(req.body);

    const rule = await prisma.routingRule.findUnique({
      where: { id: req.params.id },
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const updated = await prisma.routingRule.update({
      where: { id: req.params.id },
      data,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── DELETE /api/routing/:id — Delete rule ────

router.delete('/:id', requireAdmin, auditLog('DELETE', 'routing_rule'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();

    const rule = await prisma.routingRule.findUnique({
      where: { id: req.params.id },
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    await prisma.routingRule.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── POST /api/routing/:id/toggle — Toggle enable/disable ────

router.post('/:id/toggle', requireAdmin, auditLog('UPDATE', 'routing_rule'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();

    const rule = await prisma.routingRule.findUnique({
      where: { id: req.params.id },
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const updated = await prisma.routingRule.update({
      where: { id: req.params.id },
      data: { enabled: !rule.enabled },
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── POST /api/routing/reorder — Reorder rules ────

router.post('/reorder', requireAdmin, auditLog('UPDATE', 'routing_rule'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { ruleIds } = req.body as { ruleIds: string[] };

    if (!Array.isArray(ruleIds)) {
      return res.status(400).json({ error: 'ruleIds must be an array' });
    }

    // Set priorities based on array order (first = highest priority)
    const updates = ruleIds.map((id, index) =>
      prisma.routingRule.update({
        where: { id },
        data: { priority: ruleIds.length - index },
      })
    );

    await prisma.$transaction(updates);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── GET /api/routing/presets — Quick-add presets ────

router.get('/presets/list', async (req: AuthRequest, res: Response) => {
  const presets = [
    {
      name: 'Block Ads',
      description: 'Block common ad domains using geosite lists',
      domain: ['geosite:category-ads-all'],
      outboundTag: 'block',
    },
    {
      name: 'Block Bittorrent',
      description: 'Block BitTorrent protocol traffic',
      protocol: ['bittorrent'],
      outboundTag: 'block',
    },
    {
      name: 'Bypass Private IPs',
      description: 'Route private/local IPs directly',
      ip: ['geoip:private'],
      outboundTag: 'direct',
    },
    {
      name: 'Proxy All',
      description: 'Route all traffic through proxy (catch-all)',
      domain: ['geosite:geolocation-!cn'],
      outboundTag: 'proxy',
    },
    {
      name: 'Direct CN',
      description: 'Route Chinese IPs directly',
      ip: ['geoip:cn'],
      outboundTag: 'direct',
    },
    {
      name: 'Block Telegram',
      description: 'Block Telegram domains',
      domain: ['geosite:telegram'],
      outboundTag: 'block',
    },
  ];

  res.json(presets);
});

export default router;
