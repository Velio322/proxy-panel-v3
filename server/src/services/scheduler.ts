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

      // Ban expired clients
      const expired = await prisma.client.updateMany({
        where: {
          expireAt: { lt: now },
          banned: false,
        },
        data: { banned: true },
      });

      if (expired.count > 0) {
        console.log(`[Scheduler] Banned ${expired.count} expired clients`);
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
