import { Router, Response } from 'express';
import { getPrisma } from '../lib/prisma';
import { AuthRequest, authenticate, requireSuperAdmin } from '../middleware/auth';
import { cacheSet, cacheGet, cacheInvalidatePattern } from '../lib/redis';

const router = Router();
router.use(authenticate);
router.use(requireSuperAdmin);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const settings = await prisma.systemSetting.findMany();
    const result: Record<string, any> = {};
    settings.forEach((s) => { result[s.key] = s.value; });
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:key', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const setting = await prisma.systemSetting.findUnique({ where: { key: req.params.key } });
    if (!setting) return res.status(404).json({ error: 'Setting not found' });
    res.json({ key: setting.key, value: setting.value, description: setting.description });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:key', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { value, description } = req.body;

    const setting = await prisma.systemSetting.upsert({
      where: { key: req.params.key },
      update: { value, description },
      create: { key: req.params.key, value, description },
    });

    await cacheInvalidatePattern('settings:*');
    res.json({ key: setting.key, value: setting.value });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:key', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    await prisma.systemSetting.delete({ where: { key: req.params.key } });
    await cacheInvalidatePattern('settings:*');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Batch update
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { settings } = req.body;

    const ops = Object.entries(settings).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value: value as any },
      })
    );

    await Promise.all(ops);
    await cacheInvalidatePattern('settings:*');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
