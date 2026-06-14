import { getPrisma } from '../lib/prisma';
import { nodeGet, nodePost } from '../lib/http';
import { nodeStatus, nodeCpuUsage, nodeMemUsage } from '../metrics';
import { cacheSet, cacheGet } from '../lib/redis';

export class NodeService {
  async getNodeStatus(nodeId: string): Promise<any> {
    const prisma = getPrisma();
    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) throw new Error('Node not found');

    try {
      const response = await nodeGet(node.host, node.apiPort, '/api/status', node.secret);

      await prisma.node.update({
        where: { id: nodeId },
        data: {
          status: 'ONLINE',
          lastCheckAt: new Date(),
          lastPingMs: Date.now() - Date.now(),
          version: response.version,
          xrayVersion: response.xrayRunning ? response.version : null,
          singboxVersion: response.singboxRunning ? response.version : null,
        },
      });

      nodeStatus.set({ node_id: node.id, node_name: node.name }, 1);

      return { nodeId, status: 'ONLINE', ...response };
    } catch {
      await prisma.node.update({
        where: { id: nodeId },
        data: { status: 'OFFLINE', lastCheckAt: new Date() },
      });

      nodeStatus.set({ node_id: node.id, node_name: node.name }, 0);
      return { nodeId, status: 'OFFLINE', error: 'Failed to connect' };
    }
  }

  async getAllNodeStatuses(): Promise<any[]> {
    const prisma = getPrisma();
    const nodes = await prisma.node.findMany({ where: { active: true } });
    const statuses = await Promise.allSettled(nodes.map((n) => this.getNodeStatus(n.id)));
    return statuses.map((s, i) =>
      s.status === 'fulfilled' ? s.value : { nodeId: nodes[i].id, status: 'ERROR' }
    );
  }

  async pushConfigToNode(nodeId: string): Promise<boolean> {
    const prisma = getPrisma();
    const node = await prisma.node.findUnique({
      where: { id: nodeId },
      include: { inbounds: { include: { portShares: true } } },
    });
    if (!node) throw new Error('Node not found');

    try {
      const inbounds = node.inbounds
        .filter((i) => i.enable)
        .map((inbound) => ({
          ...inbound,
          portShares: inbound.portShares.filter((ps) => ps.enable),
        }));

      await nodePost(node.host, node.apiPort, '/api/config', node.secret, { inbounds });
      return true;
    } catch (error) {
      console.error(`[NodeService] Failed to push config to ${node.name}:`, error);
      return false;
    }
  }

  async restartNode(nodeId: string): Promise<boolean> {
    const prisma = getPrisma();
    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) throw new Error('Node not found');

    try {
      await nodePost(node.host, node.apiPort, '/api/restart', node.secret, {});
      return true;
    } catch {
      return false;
    }
  }

  async stopNode(nodeId: string): Promise<boolean> {
    const prisma = getPrisma();
    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) throw new Error('Node not found');

    try {
      await nodePost(node.host, node.apiPort, '/api/stop', node.secret, {});
      return true;
    } catch {
      return false;
    }
  }

  async getMetrics(nodeId: string): Promise<any> {
    const cached = await cacheGet(`node_metrics:${nodeId}`);
    if (cached) return cached;

    const prisma = getPrisma();
    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) throw new Error('Node not found');

    try {
      const metrics = await nodeGet(node.host, node.apiPort, '/api/metrics', node.secret);
      await cacheSet(`node_metrics:${nodeId}`, metrics, 30);

      nodeCpuUsage.set({ node_id: nodeId }, metrics.cpuUsage || 0);
      nodeMemUsage.set({ node_id: nodeId }, metrics.memUsage || 0);

      // Store metric history
      await prisma.nodeMetric.create({
        data: {
          nodeId,
          cpuUsage: metrics.cpuUsage,
          memUsage: metrics.memUsage,
          netUpload: metrics.traffic?.upload || 0,
          netDownload: metrics.traffic?.download || 0,
          connections: metrics.connections || 0,
          uptime: metrics.uptime || 0,
        },
      });

      return metrics;
    } catch {
      return null;
    }
  }
}
