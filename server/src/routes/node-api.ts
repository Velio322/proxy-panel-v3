import { Router, Response } from 'express';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { getRedis, incrTrafficStat, cacheGet, cacheSet } from '../lib/redis';

const router = Router();

// ──── Node Authentication ────

const authenticateNode = (req: AuthRequest, res: Response, next: any) => {
  const nodeSecret = req.headers['x-node-secret'] as string;
  const authHeader = req.headers.authorization;

  if (nodeSecret === config.worker.nodeSecret ||
      authHeader === `Bearer ${config.worker.nodeSecret}`) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
};

router.use(authenticateNode);

// ──── Helper: find node by IP or X-Node-Id ────

async function findNode(req: any) {
  const prisma = getPrisma();

  // Try X-Node-Id header first (worker sends its registered ID)
  const nodeId = req.headers['x-node-id'] as string;
  if (nodeId) {
    return prisma.node.findUnique({ where: { id: nodeId } });
  }

  // Fallback: find by IP
  const ip = req.ip || req.socket?.remoteAddress || '';
  // Normalize IPv6 mapped IPv4
  const normalizedIp = ip.replace(/^::ffff:/, '');
  return prisma.node.findFirst({ where: { host: normalizedIp } });
}

// ──── Worker polls this to get its config ────

router.get('/config', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const node = await findNode(req);

    if (!node) {
      return res.json({ inbounds: [], timestamp: Date.now() });
    }

    const inbounds = await prisma.inbound.findMany({
      where: { nodeId: node.id, enable: true },
      include: { portShares: { where: { enable: true } } },
    });

    res.json({
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
        enable: inb.enable,
        portShares: inb.portShares.map((ps) => ({
          id: ps.id,
          protocol: ps.protocol,
          tag: ps.tag,
          host: ps.host,
          path: ps.path,
          settings: ps.settings,
          stream: ps.stream,
          enable: ps.enable,
        })),
      })),
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ──── Worker reports status ────

router.post('/status', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const node = await findNode(req);

    if (!node) {
      return res.json({ success: true, warning: 'Node not registered' });
    }

    const {
      status, xrayRunning, singboxRunning, naiveRunning, mieruRunning,
      uptime, version, cpuUsage, memUsage, connections,
    } = req.body;

    // Update node status
    await prisma.node.update({
      where: { id: node.id },
      data: {
        status: status || 'ONLINE',
        lastCheckAt: new Date(),
        version,
        cpuUsage,
        memUsage,
        lastPingMs: req.body.pingMs || null,
        xrayVersion: xrayRunning ? version : null,
        singboxVersion: singboxRunning ? version : null,
      },
    });

    // Store metrics (keep last 24h — 288 entries at 5min intervals)
    await prisma.nodeMetric.create({
      data: {
        nodeId: node.id,
        cpuUsage,
        memUsage,
        connections: connections || 0,
        uptime: uptime || 0,
      },
    });

    // Cleanup old metrics (keep last 288 = 24h at 5min intervals)
    const cutoff = new Date(Date.now() - 86400000);
    await prisma.nodeMetric.deleteMany({
      where: { nodeId: node.id, recordedAt: { lt: cutoff } },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ──── Worker reports traffic stats (diff-based) ────

router.post('/traffic', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const node = await findNode(req);

    if (!node) {
      return res.json({ success: true, warning: 'Node not registered' });
    }

    const { stats } = req.body;
    if (!stats || typeof stats !== 'object') {
      return res.json({ success: true });
    }

    const r = getRedis();
    const now = new Date();
    const minute = now.toISOString().slice(0, 16); // "2024-01-15T10:30"

    // Process each user's traffic
    // Xray stats API returns cumulative traffic per email
    // We need to compute diff from previous report
    for (const [email, traffic] of Object.entries(stats)) {
      const { upload = 0, download = 0 } = traffic as { upload: number; download: number };
      if (upload === 0 && download === 0) continue;

      // Get previous cumulative values from Redis
      const prevKey = `traffic_prev:${node.id}:${email}`;
      const prevUpload = parseInt(await r.get(`${prevKey}:up`) || '0');
      const prevDownload = parseInt(await r.get(`${prevKey}:down`) || '0');

      // Compute diff (handle counter reset — if current < previous, assume full reset)
      const diffUpload = upload >= prevUpload ? upload - prevUpload : upload;
      const diffDownload = download >= prevDownload ? download - prevDownload : download;

      if (diffUpload === 0 && diffDownload === 0) continue;

      // Store current values for next diff
      const pipeline = r.pipeline();
      pipeline.set(`${prevKey}:up`, String(upload));
      pipeline.set(`${prevKey}:down`, String(download));
      pipeline.expire(`${prevKey}:up`, 86400);
      pipeline.expire(`${prevKey}:down`, 86400);

      // Real-time traffic counters in Redis
      const dayKey = now.toISOString().slice(0, 10);
      pipeline.incrbyfloat(`traffic_realtime:${node.id}:${dayKey}:up`, diffUpload);
      pipeline.incrbyfloat(`traffic_realtime:${node.id}:${dayKey}:down`, diffDownload);
      pipeline.incrbyfloat(`traffic_realtime_client:${dayKey}:up`, diffUpload);
      pipeline.incrbyfloat(`traffic_realtime_client:${dayKey}:down`, diffDownload);
      pipeline.expire(`traffic_realtime:${node.id}:${dayKey}:up`, 86400 * 7);
      pipeline.expire(`traffic_realtime:${node.id}:${dayKey}:down`, 86400 * 7);
      pipeline.expire(`traffic_realtime_client:${dayKey}:up`, 86400 * 7);
      pipeline.expire(`traffic_realtime_client:${dayKey}:down`, diffDownload);

      await pipeline.exec();

      // Find client by email (Xray uses email as user identifier)
      // Client email format: {clientUsername}@panel
      const client = await prisma.client.findFirst({
        where: {
          email: email,
        },
      });

      if (!client) {
        // Try finding by username (strip @panel suffix)
        const username = email.replace(/@panel$/, '').replace(/@.*$/, '');
        const clientByUsername = await prisma.client.findFirst({
          where: { username },
        });

        if (!clientByUsername) continue;
        await upsertTrafficLog(prisma, clientByUsername.id, node.id, diffUpload, diffDownload, now);
        continue;
      }

      await upsertTrafficLog(prisma, client.id, node.id, diffUpload, diffDownload, now);
    }

    res.json({ success: true, timestamp: Date.now() });
  } catch (error: any) {
    console.error('[NodeAPI] Traffic processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ──── Worker pulls config for a specific client ────

router.get('/clients/:email/config', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const node = await findNode(req);

    if (!node) {
      return res.status(404).json({ error: 'Node not registered' });
    }

    const email = req.params.email;
    const username = email.replace(/@panel$/, '').replace(/@.*$/, '');

    const client = await prisma.client.findFirst({
      where: { OR: [{ email }, { username }] },
      include: { settings: true },
    });

    if (!client || client.banned) {
      return res.status(404).json({ error: 'Client not found or banned' });
    }

    // Check limits
    if (client.expireAt && client.expireAt < new Date()) {
      return res.status(403).json({ error: 'Expired' });
    }
    if (client.trafficLimit > 0 && client.usedTraffic >= client.trafficLimit) {
      return res.status(403).json({ error: 'Traffic limit exceeded' });
    }

    // Get inbounds for this node
    const inbounds = await prisma.inbound.findMany({
      where: {
        nodeId: node.id,
        enable: true,
        protocol: { in: (client.protocols as string[] || ['VLESS', 'HYSTERIA2']) as any[] },
      },
    });

    res.json({
      client: {
        uuid: client.uuid,
        email: client.email || `${client.username}@panel`,
        username: client.username,
      },
      inbounds: inbounds.map((i) => ({
        protocol: i.protocol,
        tag: i.tag,
        port: i.port,
        settings: i.settings,
        stream: i.stream,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ──── Traffic query endpoints (for dashboard) ────

router.get('/traffic/realtime', async (req: AuthRequest, res: Response) => {
  try {
    const r = getRedis();
    const { days = '7' } = req.query as any;
    const result: any[] = [];

    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayKey = date.toISOString().slice(0, 10);

      const up = await r.get(`traffic_realtime_client:${dayKey}:up`);
      const down = await r.get(`traffic_realtime_client:${dayKey}:down`);

      result.push({
        date: dayKey,
        upload: parseFloat(up || '0'),
        download: parseFloat(down || '0'),
      });
    }

    res.json(result.reverse());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/traffic/node/:nodeId', async (req: AuthRequest, res: Response) => {
  try {
    const r = getRedis();
    const { nodeId } = req.params;
    const { days = '7' } = req.query as any;
    const result: any[] = [];

    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayKey = date.toISOString().slice(0, 10);

      const up = await r.get(`traffic_realtime:${nodeId}:${dayKey}:up`);
      const down = await r.get(`traffic_realtime:${nodeId}:${dayKey}:down`);

      result.push({
        date: dayKey,
        upload: parseFloat(up || '0'),
        download: parseFloat(down || '0'),
      });
    }

    res.json(result.reverse());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ──── Helpers ────

async function upsertTrafficLog(
  prisma: any,
  clientId: string,
  nodeId: string,
  upload: number,
  download: number,
  recordAt: Date
): Promise<void> {
  // Create traffic log entry
  await prisma.trafficLog.create({
    data: {
      clientId,
      nodeId,
      upload: BigInt(upload),
      download: BigInt(download),
      recordAt,
    },
  });

  // Update client cumulative counters
  const totalTraffic = BigInt(upload) + BigInt(download);
  await prisma.client.update({
    where: { id: clientId },
    data: {
      usedTraffic: { increment: totalTraffic },
      uploadTraffic: { increment: BigInt(upload) },
      downloadTraffic: { increment: BigInt(download) },
      lastActiveAt: recordAt,
    },
  });

  // Check if client exceeded traffic limit — auto-ban
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (client && client.trafficLimit > 0 && client.usedTraffic >= client.trafficLimit) {
    await prisma.client.update({
      where: { id: clientId },
      data: { banned: true },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        type: 'TRAFFIC_LIMIT',
        title: 'Traffic limit exceeded',
        message: `Client ${client.username} exceeded traffic limit (${formatBytes(Number(client.usedTraffic))}/${formatBytes(Number(client.trafficLimit))})`,
        targetResellerId: client.resellerId,
      },
    });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;
