import { Router, Response } from 'express';
import net from 'net';
import { z } from 'zod';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { AuthRequest, authenticate, requireAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { NodeService } from '../services/nodeService';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis';
import { spawn } from 'child_process';
import path from 'path';
import crypto from 'crypto';

const router = Router();
router.use(authenticate);

const nodeService = new NodeService();

function checkReachability(host: string, port: number, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

function isLocalHost(host: string): boolean {
  return ['127.0.0.1', 'localhost', '::1', '0.0.0.0'].includes(host);
}

function buildSetupInstructions(nodeSecret: string, apiPort: number): string {
  return [
    '=== Remote Node Setup Instructions ===',
    '',
    'Option 1: Automatic installation',
    '  Run on the remote server:',
    `  bash <(curl -Ls https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/install.sh)`,
    '  Select "Node only" and enter the panel URL + secret below.',
    '',
    'Option 2: Manual installation',
    '  1. Install Node.js 18+ on the remote server',
    '  2. Download the worker source:',
    '     curl -sL https://github.com/Velio322/proxy-panel-v3/archive/refs/heads/main.tar.gz | tar xz',
    '     cd proxy-panel-v3-main/server && npm install --no-workspaces && npx prisma generate && npm run build',
    '  3. Create .env file:',
    `     MASTER_URL=https://<YOUR_PANEL_DOMAIN>`,
    `     NODE_RPC_SECRET=${nodeSecret}`,
    `     WORKER_PORT=${apiPort}`,
    '     CONFIG_DIR=/etc/proxpanel',
    '     XRAY_BIN=/usr/local/bin/xray',
    '     SINGBOX_BIN=/usr/local/bin/sing-box',
    '     NAIVE_BIN=/usr/local/bin/naive',
    '     MIERU_BIN=/usr/local/bin/mieru',
    '  4. Download proxy binaries (Xray, sing-box) to the paths above',
    '  5. Start the worker: node dist/worker/index.js',
    '',
    `Secret: ${nodeSecret}`,
    `API Port: ${apiPort}`,
    '=========================================',
  ].join('\n');
}

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

    // Check reachability for remote nodes
    if (!isLocalHost(data.host)) {
      const reachable = await checkReachability(data.host, data.apiPort);
      if (!reachable) {
        return res.status(422).json({
          error: `Node at ${data.host}:${data.apiPort} is unreachable. Check firewall rules and ensure the worker is running.`,
          reachable: false,
          setupInstructions: buildSetupInstructions(data.secret, data.apiPort),
        });
      }
    }

    const node = await prisma.node.create({ data });
    res.status(201).json({
      ...node,
      setupInstructions: isLocalHost(data.host) ? undefined : buildSetupInstructions(data.secret, data.apiPort),
    });
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

// Helper functions for local node setup
function checkLocalPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findLocalFreePort(startPort: number, excludePorts: number[] = []): Promise<number> {
  let port = startPort;
  while (true) {
    if (!excludePorts.includes(port)) {
      const available = await checkLocalPortAvailable(port);
      if (available) return port;
    }
    port++;
  }
}

async function runLocalDeploymentWorker(nodeId: string, token: string, apiPort: number, sftpPort: number) {
  console.log(`[DeployWorker] Starting local node deployment for node: ${nodeId}...`);
  const deployScript = path.resolve(__dirname, '../../../scripts/deploy-local-node.sh');
  
  const child = spawn('bash', [deployScript, nodeId, token, String(apiPort), String(sftpPort)], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

router.post('/local', requireAdmin, auditLog('CREATE', 'node'), async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Node name is required' });

    const prisma = getPrisma();

    // Find free ports
    const panelPort = parseInt(process.env.API_PORT || '3000', 10);
    const apiPort = await findLocalFreePort(2087, [panelPort, 80, 443]);
    const sftpPort = await findLocalFreePort(2022, [panelPort, 80, 443, apiPort]);

    const token = crypto.randomBytes(32).toString('hex');

    const node = await prisma.node.create({
      data: {
        name,
        host: '127.0.0.1',
        port: 443,
        apiPort,
        secret: token,
        status: 'OFFLINE',
        active: true,
      },
    });

    // Run deployment in background
    runLocalDeploymentWorker(node.id, token, apiPort, sftpPort).catch((err) => {
      console.error('[DeployWorker] Error:', err);
    });

    res.status(202).json({
      message: 'Node installation initiated',
      nodeId: node.id,
      apiPort,
      sftpPort,
      token,
      apiUrl: process.env.API_URL || 'http://127.0.0.1:3000',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
