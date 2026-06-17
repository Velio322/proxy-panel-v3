import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { getPrisma } from '../lib/prisma';
import { getTrafficBatcher } from '../lib/traffic-batcher';

interface WorkerConnection {
  ws: WebSocket;
  nodeId: string;
  lastSeen: Date;
  isAlive: boolean;
}

export class WorkerSocketManager {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, WorkerConnection> = new Map();
  private static instance: WorkerSocketManager;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): WorkerSocketManager {
    if (!WorkerSocketManager.instance) {
      WorkerSocketManager.instance = new WorkerSocketManager();
    }
    return WorkerSocketManager.instance;
  }

  public init(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws/worker',
      clientTracking: true,
      maxPayload: 1024 * 1024 // 1MB
    });

    this.wss.on('connection', async (ws, req) => {
      const authHeader = req.headers['authorization'];
      const nodeSecret = req.headers['x-node-secret'] || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

      if (!nodeSecret) {
        console.log('[WS] Rejected: No secret provided');
        ws.close(4001, 'Unauthorized');
        return;
      }

      const prisma = getPrisma();
      const node = await prisma.node.findFirst({
        where: { secret: String(nodeSecret), active: true }
      });

      if (!node) {
        console.log('[WS] Rejected: Invalid secret');
        ws.close(4001, 'Invalid node secret');
        return;
      }

      // If already connected, close old one
      if (this.connections.has(node.id)) {
        const old = this.connections.get(node.id);
        old?.ws.terminate();
      }

      console.log(`[WS] Worker connected: ${node.name} (${node.id})`);
      
      const conn: WorkerConnection = {
        ws,
        nodeId: node.id,
        lastSeen: new Date(),
        isAlive: true,
      };

      this.connections.set(node.id, conn);

      ws.on('pong', () => {
        conn.isAlive = true;
        conn.lastSeen = new Date();
      });

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());
          await this.handleMessage(node.id, msg);
        } catch (error) {
          console.error(`[WS] Message error from ${node.name}:`, error);
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`[WS] Worker disconnected: ${node.name} (Code: ${code}, Reason: ${reason})`);
        this.connections.delete(node.id);
        
        prisma.node.update({
          where: { id: node.id },
          data: { status: 'OFFLINE' }
        }).catch(() => {});
      });

      ws.on('error', (err) => {
        console.error(`[WS] Socket error from ${node.name}:`, err.message);
      });

      // Update node status to ONLINE
      await prisma.node.update({
        where: { id: node.id },
        data: { status: 'ONLINE', lastCheckAt: new Date() }
      });

      // Immediate config push
      await this.pushConfig(node.id);
    });

    // Start heartbeats
    this.heartbeatInterval = setInterval(() => {
      this.connections.forEach((conn, nodeId) => {
        if (conn.isAlive === false) {
          console.log(`[WS] Node ${nodeId} heartbeat timeout, terminating...`);
          return conn.ws.terminate();
        }
        conn.isAlive = false;
        conn.ws.ping();
      });
    }, 30000);

    console.log('[WS] Worker WebSocket server initialized on /ws/worker');
  }

  private async handleMessage(nodeId: string, msg: { event: string; payload: any }) {
    const prisma = getPrisma();

    switch (msg.event) {
      case 'config_request':
        await this.pushConfig(nodeId);
        break;

      case 'status_report':
        await prisma.node.update({
          where: { id: nodeId },
          data: {
            cpuUsage: msg.payload.cpuUsage,
            memUsage: msg.payload.memUsage,
            version: msg.payload.version,
            lastCheckAt: new Date(),
            status: 'ONLINE'
          }
        });
        break;

      case 'traffic_report':
        if (msg.payload.stats) {
          const batcher = getTrafficBatcher();
          for (const [email, stat] of Object.entries(msg.payload.stats as any)) {
            batcher.add({
              nodeId,
              email,
              upload: (stat as any).upload || 0,
              download: (stat as any).download || 0,
            });
          }
        }
        break;

      case 'heartbeat':
        const conn = this.connections.get(nodeId);
        if (conn) {
          conn.isAlive = true;
          conn.lastSeen = new Date();
        }
        break;

      default:
        console.log(`[WS] Unknown event from ${nodeId}: ${msg.event}`);
    }
  }

  public async pushConfig(nodeId: string) {
    const conn = this.connections.get(nodeId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;

    try {
      const prisma = getPrisma();
      const inbounds = await prisma.inbound.findMany({
        where: { nodeId, enable: true },
        include: { portShares: { where: { enable: true } } }
      });

      // Prepare optimized payload
      const payload = {
        inbounds: inbounds.map(i => ({
          ...i,
          // Ensure BigInts (if any) are converted or stripped if not needed
        })),
        timestamp: Date.now()
      };

      conn.ws.send(JSON.stringify({
        event: 'config_update',
        payload
      }));
      
      console.log(`[WS] Pushed config to node ${nodeId} (${inbounds.length} inbounds)`);
    } catch (err: any) {
      console.error(`[WS] Push config failed for ${nodeId}:`, err.message);
    }
  }

  public async broadcastConfigUpdate() {
    const nodeIds = Array.from(this.connections.keys());
    await Promise.all(nodeIds.map(id => this.pushConfig(id)));
  }

  public isNodeOnline(nodeId: string): boolean {
    const conn = this.connections.get(nodeId);
    return !!conn && conn.ws.readyState === WebSocket.OPEN;
  }

  public stop() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.wss?.close();
  }
}

export const getWorkerSocketManager = () => WorkerSocketManager.getInstance();
