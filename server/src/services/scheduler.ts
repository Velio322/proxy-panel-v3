import cron from 'node-cron';
import { getPrisma } from '../lib/prisma';
import { NodeService } from './nodeService';

const nodeService = new NodeService();

export function startScheduler() {
  // Check node health every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    try {
      await nodeService.getAllNodeStatuses();
    } catch (error) {
      console.error('[Scheduler] Node health check failed:', error);
    }
  });

  // Check expired clients every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const prisma = getPrisma();
      const now = new Date();

      // Find expired clients
      const expiredClients = await prisma.client.findMany({
        where: {
          expireAt: { not: null, lt: now },
          banned: false,
        },
        select: { id: true, subToken: true },
      });

      if (expiredClients.length > 0) {
        await prisma.client.updateMany({
          where: { id: { in: expiredClients.map((c) => c.id) } },
          data: { banned: true },
        });

        const { cacheInvalidatePattern } = await import('../lib/redis');
        for (const c of expiredClients) {
          await cacheInvalidatePattern(`sub:${c.subToken}*`);
        }
        console.log(`[Scheduler] Banned ${expiredClients.length} expired clients`);
      }
    } catch (error) {
      console.error('[Scheduler] Expiry check failed:', error);
    }
  });

  // Auto-push configs every 5 minutes for changed nodes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const prisma = getPrisma();
      const nodes = await prisma.node.findMany({ where: { status: 'ONLINE', active: true } });

      for (const node of nodes) {
        try {
          await nodeService.pushConfigToNode(node.id);
        } catch (error) {
          console.error(`[Scheduler] Auto-push to ${node.name} failed:`, error);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Config push cycle failed:', error);
    }
  });

  // Collect node metrics every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const prisma = getPrisma();
      const nodes = await prisma.node.findMany({ where: { status: 'ONLINE', active: true } });

      for (const node of nodes) {
        try {
          await nodeService.getMetrics(node.id);
        } catch (error) {
          console.error(`[Scheduler] Metrics collection for ${node.name} failed:`, error);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Metrics cycle failed:', error);
    }
  });

  // Backup at configured time
  const backupInterval = process.env.BACKUP_INTERVAL || '0 3 * * *';
  cron.schedule(backupInterval, async () => {
    try {
      console.log('[Scheduler] Running scheduled backup');
      // Backup logic handled by backup route
    } catch (error) {
      console.error('[Scheduler] Backup failed:', error);
    }
  });

  console.log('[Scheduler] Started all scheduled tasks');
}
