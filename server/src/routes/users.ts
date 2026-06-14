import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { AuthRequest, authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { createAuditLog } from '../lib/audit';
import { cacheInvalidatePattern } from '../lib/redis';

const router = Router();
router.use(authenticate);

// ──── Validation Schemas ────

const createUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, - and _'),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(), // auto-generated if not provided
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'RESELLER', 'OPERATOR']).optional(),
  resellerId: z.string().uuid().optional(),
  language: z.enum(['en', 'ru', 'zh', 'fa']).optional(),
  generatePassword: z.boolean().optional(), // force auto-generate
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'RESELLER', 'OPERATOR']).optional(),
  resellerId: z.string().uuid().nullable().optional(),
  language: z.enum(['en', 'ru', 'zh', 'fa']).optional(),
  banned: z.boolean().optional(),
});

const createResellerUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  language: z.enum(['en', 'ru', 'zh', 'fa']).optional(),
});

// ──── Helpers ────

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < 16; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

function canManageRole(actorRole: string, targetRole: string): boolean {
  const hierarchy: Record<string, number> = {
    SUPER_ADMIN: 4,
    ADMIN: 3,
    RESELLER: 2,
    OPERATOR: 1,
  };
  return (hierarchy[actorRole] || 0) > (hierarchy[targetRole] || 0);
}

// ──── Routes ────

router.get('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { search, page = '1', limit = '20', role, resellerId, banned } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);

    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (resellerId) where.resellerId = resellerId;
    if (banned !== undefined) where.banned = banned === 'true';

    // Resellers see only their own users
    if (req.user?.role === 'RESELLER') {
      where.resellerId = req.user.resellerId;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, username: true, email: true, role: true,
          resellerId: true, language: true, banned: true,
          lastLoginAt: true, lastLoginIp: true, createdAt: true,
        },
        skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data: users,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / take),
      limit: take,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, username: true, email: true, role: true,
        resellerId: true, language: true, banned: true,
        lastLoginAt: true, lastLoginIp: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── Create User ────

router.post('/', requireAdmin, auditLog('CREATE', 'user'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const data = createUserSchema.parse(req.body);

    // Role hierarchy check
    const targetRole = data.role || 'OPERATOR';
    if (!canManageRole(req.user!.role, targetRole)) {
      return res.status(403).json({ error: 'Cannot create user with this role' });
    }

    // Username uniqueness
    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Email uniqueness
    if (data.email) {
      const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
      if (existingEmail) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    // Reseller scope: resellers can only create OPERATOR users under themselves
    let resellerId = data.resellerId;
    let role = targetRole;
    if (req.user!.role === 'RESELLER') {
      resellerId = req.user!.resellerId;
      role = 'OPERATOR'; // resellers can only create operators
    }

    // Password handling
    let plainPassword: string;
    let hashedPassword: string;

    if (data.generatePassword || !data.password) {
      plainPassword = generatePassword();
      hashedPassword = await bcrypt.hash(plainPassword, 12);
    } else {
      plainPassword = data.password;
      hashedPassword = await bcrypt.hash(data.password, 12);
    }

    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: hashedPassword,
        role,
        resellerId,
        language: data.language || 'en',
      },
      select: {
        id: true, username: true, email: true, role: true,
        resellerId: true, language: true, createdAt: true,
      },
    });

    // Return plain password (only on creation)
    res.status(201).json({
      ...user,
      password: plainPassword, // shown once, never stored as plain
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── Create Reseller + User in one shot ────

router.post('/create-reseller', requireSuperAdmin, auditLog('CREATE', 'reseller+user'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { reseller, user: userData } = req.body;

    const resellerData = z.object({
      name: z.string().min(1),
      contactEmail: z.string().email().optional(),
      contactTelegram: z.string().optional(),
      maxClients: z.number().min(1).optional().default(100),
      trafficLimit: z.number().min(0).optional(),
    }).parse(reseller);

    const userParsed = createResellerUserSchema.parse(userData);

    // Create reseller
    const newReseller = await prisma.reseller.create({
      data: {
        name: resellerData.name,
        contactEmail: resellerData.contactEmail,
        contactTelegram: resellerData.contactTelegram,
        maxClients: resellerData.maxClients,
        trafficLimit: BigInt(resellerData.trafficLimit || 107374182400),
      },
    });

    // Create reseller user
    const plainPassword = userParsed.password || generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const user = await prisma.user.create({
      data: {
        username: userParsed.username,
        email: userParsed.email,
        password: hashedPassword,
        role: 'RESELLER',
        resellerId: newReseller.id,
        language: userParsed.language || 'en',
      },
      select: {
        id: true, username: true, email: true, role: true,
        resellerId: true, language: true, createdAt: true,
      },
    });

    res.status(201).json({
      reseller: serializeBigInt(newReseller),
      user: { ...user, password: plainPassword },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── Update User ────

router.put('/:id', requireAdmin, auditLog('UPDATE', 'user'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Cannot edit yourself
    if (req.params.id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot edit your own account here' });
    }

    // Role hierarchy check
    const data = updateUserSchema.parse(req.body);
    if (data.role && !canManageRole(req.user!.role, data.role)) {
      return res.status(403).json({ error: 'Cannot assign this role' });
    }

    // Cannot promote to SUPER_ADMIN
    if (data.role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only SUPER_ADMIN can assign this role' });
    }

    const updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true, username: true, email: true, role: true,
        resellerId: true, language: true, banned: true, createdAt: true,
      },
    });

    await cacheInvalidatePattern(`user:${req.params.id}*`);
    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── Delete User ────

router.delete('/:id', requireAdmin, auditLog('DELETE', 'user'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();

    if (req.params.id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Cannot delete SUPER_ADMIN
    if (target.role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Cannot delete SUPER_ADMIN' });
    }

    // Delete related sessions and API keys
    await prisma.userSession.deleteMany({ where: { userId: req.params.id } });
    await prisma.apiKey.deleteMany({ where: { userId: req.params.id } });
    await prisma.user.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── Reset Password ────

router.post('/:id/reset-password', requireAdmin, auditLog('RESET_PASSWORD', 'user'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (target.role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Cannot reset SUPER_ADMIN password' });
    }

    const newPass = generatePassword();
    await prisma.user.update({
      where: { id: req.params.id },
      data: { password: await bcrypt.hash(newPass, 12) },
    });

    // Invalidate all sessions for this user
    await prisma.userSession.deleteMany({ where: { userId: req.params.id } });

    res.json({ password: newPass });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── Toggle Ban ────

router.post('/:id/toggle-ban', requireAdmin, auditLog('TOGGLE_BAN', 'user'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();

    if (req.params.id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot ban yourself' });
    }

    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (target.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Cannot ban SUPER_ADMIN' });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { banned: !target.banned },
      select: { id: true, banned: true },
    });

    if (updated.banned) {
      await prisma.userSession.deleteMany({ where: { userId: req.params.id } });
    }

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── API Keys ────

router.get('/:id/api-keys', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.params.id },
      select: {
        id: true, name: true, permissions: true,
        expiresAt: true, lastUsedAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(keys);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/api-keys', requireAdmin, auditLog('CREATE', 'apiKey'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { name, permissions, expiresAt } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    const key = `pk_${uuidv4().replace(/-/g, '')}`;

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: req.params.id,
        key,
        name,
        permissions: permissions || [],
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      select: {
        id: true, name: true, key: true, permissions: true,
        expiresAt: true, createdAt: true,
      },
    });

    res.status(201).json(apiKey); // key shown once
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:userId/api-keys/:keyId', requireAdmin, auditLog('DELETE', 'apiKey'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    await prisma.apiKey.delete({
      where: { id: req.params.keyId, userId: req.params.userId },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
