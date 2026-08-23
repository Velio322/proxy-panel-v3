import { Router, Response } from 'express';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { AuthRequest, authenticate, requireSuperAdmin } from '../middleware/auth';
import { config } from '../config';

const router = Router();
router.use(authenticate);
router.use(requireSuperAdmin);

router.get('/logs', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { page = '1', limit = '20' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      prisma.backupLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.backupLog.count(),
    ]);

    res.json(serializeBigInt({
      data: logs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    }));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/trigger', async (req: AuthRequest, res: Response) => {
  try {
    const { type = 'FULL', destination = 'local' } = req.body;

    const prisma = getPrisma();
    const log = await prisma.backupLog.create({
      data: {
        type: type as any,
        status: 'IN_PROGRESS',
        destination,
      },
    });

    // Trigger backup in background
    performBackup(log.id, type, destination).catch(console.error);

    res.json({ id: log.id, status: 'IN_PROGRESS' });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/config', async (req: AuthRequest, res: Response) => {
  res.json({
    enabled: config.backup.enabled,
    interval: config.backup.interval,
    destinations: {
      telegram: !!config.backup.telegramBotToken,
      s3: !!config.backup.s3Bucket,
      local: true,
    },
  });
});

async function performBackup(logId: string, type: string, destination: string) {
  const prisma = getPrisma();
  const os = require('os');
  const path = require('path');
  const fs = require('fs');
  const { execFileSync } = require('child_process');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `proxpanel-backup-${type.toLowerCase()}-${timestamp}.sql`;
  const filePath = path.join(os.tmpdir(), filename);

  try {
    // Export database
    try {
      const output = execFileSync('pg_dump', [config.database.url, '--clean', '--if-exists'], {
        timeout: 300000,
        maxBuffer: 100 * 1024 * 1024,
      });
      fs.writeFileSync(filePath, output);
    } catch {
      // Fallback dump as JSON if pg_dump CLI is unavailable in environment
      const [users, inbounds, nodes, clients, plans, settings] = await Promise.all([
        prisma.user.findMany(),
        prisma.inbound.findMany(),
        prisma.node.findMany(),
        prisma.client.findMany(),
        prisma.plan.findMany(),
        prisma.systemSetting.findMany().catch(() => []),
      ]);
      const jsonDump = JSON.stringify(
        serializeBigInt({ version: '2.0.0', timestamp, users, inbounds, nodes, clients, plans, settings }),
        null,
        2
      );
      fs.writeFileSync(filePath, jsonDump, 'utf-8');
    }

    const stats = fs.statSync(filePath);

    await prisma.backupLog.update({
      where: { id: logId },
      data: {
        status: 'SUCCESS',
        filePath,
        fileSize: stats.size,
      },
    });

    // Send to Telegram if configured
    if (destination === 'telegram' && config.backup.telegramBotToken) {
      const { Telegraf } = require('telegraf');
      const bot = new Telegraf(config.backup.telegramBotToken);
      await bot.telegram.sendDocument(
        config.backup.telegramChatId,
        { source: filePath },
        { caption: `ProxPanel backup: ${type} (${(stats.size / 1024 / 1024).toFixed(2)} MB)` }
      );
      // Clean up temp file only for remote upload destinations
      try { fs.unlinkSync(filePath); } catch {}
    }
  } catch (error: any) {
    await prisma.backupLog.update({
      where: { id: logId },
      data: { status: 'FAILED', error: error.message },
    });
  }
}

export default router;
