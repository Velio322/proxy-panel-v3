import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';
import { getPrisma } from '../lib/prisma';
import { createAuditLog } from '../lib/audit';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.banned) {
      return res.status(403).json({ error: 'Account is banned' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: req.ip },
    });

    const tokenPayload: any = {
      id: user.id,
      username: user.username,
      role: user.role,
    };
    if (user.resellerId) {
      tokenPayload.resellerId = user.resellerId;
    }

    const token = jwt.sign(tokenPayload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    // Store session
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'LOGIN',
      resource: 'user',
      resourceId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        resellerId: user.resellerId,
        language: user.language,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as { id: string };
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true, username: true, email: true, role: true,
        resellerId: true, language: true, createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.json({ success: true });

  try {
    const token = authHeader.split(' ')[1];
    const prisma = getPrisma();
    await prisma.userSession.deleteMany({ where: { token } });
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

export default router;
