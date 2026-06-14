import { Router, Response } from 'express';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { AuthRequest, authenticate, requireAdmin } from '../middleware/auth';
import { getAuditLogs } from '../lib/audit';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, resource, action, startDate, endDate, page, limit } = req.query as any;

    const result = await getAuditLogs({
      userId,
      resource,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });

    res.json(serializeBigInt(result));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/resources', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const resources = await prisma.auditLog.groupBy({
      by: ['resource'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    res.json(resources);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/actions', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const actions = await prisma.auditLog.groupBy({
      by: ['action'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    res.json(actions);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
