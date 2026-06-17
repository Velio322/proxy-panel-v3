import { Router, Request, Response } from 'express';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { config } from '../config';

const router = Router();

// ══════════════════════════════════════════════
// POST /api/v1/nodes/self/register
// Remote worker handshake: register node with master
// ══════════════════════════════════════════════

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { token, name, host, port, apiPort, system } = req.body;

    // Validate token
    if (!token || token !== config.worker.nodeSecret) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }

    const prisma = getPrisma();

    // Check if node already registered by name or host
    const existing = await prisma.node.findFirst({
      where: {
        OR: [
          { name: name || '' },
          { host: host || req.ip },
        ],
      },
    });

    if (existing) {
      // Update existing node
      const updated = await prisma.node.update({
        where: { id: existing.id },
        data: {
          name: name || existing.name,
          host: host || req.ip,
          port: port || existing.port,
          apiPort: apiPort || existing.apiPort,
          status: 'ONLINE',
          lastCheckAt: new Date(),
          version: system?.release || existing.version,
        },
      });

      console.log(`[Handshake] Node "${updated.name}" re-registered (${updated.id})`);
      return res.json({
        nodeId: updated.id,
        status: 're-registered',
        message: 'Node updated successfully',
      });
    }

    // Create new node
    const node = await prisma.node.create({
      data: {
        name: name || `node-${Date.now()}`,
        host: host || req.ip || '0.0.0.0',
        port: port || 443,
        apiPort: apiPort || 2087,
        secret: token,
        status: 'ONLINE',
        lastCheckAt: new Date(),
        version: system?.release || null,
        cpuUsage: null,
        memUsage: null,
        tags: [],
        active: true,
      },
    });

    console.log(`[Handshake] New node registered: "${node.name}" (${node.id}) from ${host || req.ip}`);

    // Log audit event
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        resource: 'node',
        resourceId: node.id,
        details: {
          name: node.name,
          host: node.host,
          system: system || {},
          source: 'worker-handshake',
        },
        ip: req.ip,
      },
    });

    res.status(201).json({
      nodeId: node.id,
      status: 'registered',
      message: 'Node registered successfully',
    });
  } catch (error: any) {
    console.error('[Handshake] Error:', error.message);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// ══════════════════════════════════════════════
// POST /api/v1/nodes/self/heartbeat
// Worker sends periodic health/status updates
// ══════════════════════════════════════════════

router.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token || token !== config.worker.nodeSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { nodeId, status, cpuUsage, memUsage, uptime, connections } = req.body;

    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId required' });
    }

    const prisma = getPrisma();

    // Update node status
    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    await prisma.node.update({
      where: { id: nodeId },
      data: {
        status: status || 'ONLINE',
        cpuUsage: cpuUsage ?? null,
        memUsage: memUsage ?? null,
        lastCheckAt: new Date(),
        lastPingMs: null, // Could calculate RTT
      },
    });

    // Store metric
    await prisma.nodeMetric.create({
      data: {
        nodeId,
        cpuUsage: cpuUsage ?? null,
        memUsage: memUsage ?? null,
        netUpload: 0,
        netDownload: 0,
        connections: connections || 0,
        uptime: uptime || 0,
      },
    }).catch(() => {}); // Non-critical

    res.json({ status: 'ok' });
  } catch (error: any) {
    console.error('[Heartbeat] Error:', error.message);
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

// ══════════════════════════════════════════════
// POST /api/v1/nodes/self/alert
// Worker reports critical alerts
// ══════════════════════════════════════════════

router.post('/alert', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (!token || token !== config.worker.nodeSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { nodeId, core, type, message, stderr } = req.body;

    const prisma = getPrisma();

    // Store as audit log
    await prisma.auditLog.create({
      data: {
        action: 'ALERT',
        resource: 'node',
        resourceId: nodeId,
        details: {
          core,
          type,
          message,
          stderr: stderr?.slice(0, 10),
          source: 'worker-alert',
        },
        ip: req.ip,
      },
    });

    // Update node status if crash
    if (nodeId && (type === 'crash' || type === 'start_failed')) {
      await prisma.node.update({
        where: { id: nodeId },
        data: { status: 'ERROR' },
      }).catch(() => {});
    }

    console.warn(`[Alert] Node ${nodeId}: [${core}] ${type} - ${message}`);

    res.json({ status: 'acknowledged' });
  } catch (error: any) {
    console.error('[Alert] Error:', error.message);
    res.status(500).json({ error: 'Alert failed' });
  }
});

// ══════════════════════════════════════════════
// GET /api/v1/nodes/self/config
// Worker fetches its configuration
// ══════════════════════════════════════════════

router.get('/config', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (!token || token !== config.worker.nodeSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const nodeId = req.query.nodeId as string;
    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId required' });
    }

    const prisma = getPrisma();

    const inbounds = await prisma.inbound.findMany({
      where: { nodeId, enable: true },
      include: { portShares: true },
    });

    const node = await prisma.node.findUnique({ where: { id: nodeId } });

    res.json(serializeBigInt({
      nodeId,
      nodeName: node?.name,
      inbounds: inbounds.map((inb) => ({
        id: inb.id,
        protocol: inb.protocol,
        tag: inb.tag,
        port: inb.port,
        listen: inb.listen,
        settings: inb.settings,
        stream: inb.stream,
        routing: inb.routing,
        sniffing: inb.sniffing,
        remark: inb.remark,
        enable: inb.enable,
        portShares: inb.portShares,
      })),
      timestamp: Date.now(),
    }));
  } catch (error: any) {
    console.error('[Config] Error:', error.message);
    res.status(500).json({ error: 'Config fetch failed' });
  }
});

// ══════════════════════════════════════════════
// POST /api/v1/nodes/self/traffic
// Worker reports traffic usage (Fallback for WS)
// ══════════════════════════════════════════════

router.post('/traffic', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (!token || token !== config.worker.nodeSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { nodeId, stats } = req.body;
    if (!nodeId || !stats) {
      return res.status(400).json({ error: 'nodeId and stats required' });
    }

    const { getTrafficBatcher } = await import('../lib/traffic-batcher');
    const batcher = getTrafficBatcher();

    // stats: Record<email, { upload, download }>
    for (const [email, stat] of Object.entries(stats as any)) {
      await batcher.add({
        nodeId,
        email,
        upload: (stat as any).upload || 0,
        download: (stat as any).download || 0,
      });
    }

    res.json({ status: 'ok', processed: Object.keys(stats).length });
  } catch (error: any) {
    console.error('[Traffic] Error:', error.message);
    res.status(500).json({ error: 'Traffic report failed' });
  }
});

export default router;
