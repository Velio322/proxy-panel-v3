import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuditAction } from '../types';

const prisma = new PrismaClient();

export const auditLog = (action: string, resource: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode < 400) {
        const entry: AuditAction = {
          userId: req.user?.id,
          action,
          resource,
          resourceId: req.params.id,
          details: {
            method: req.method,
            path: req.path,
            body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
          },
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        };

        prisma.auditLog.create({ data: entry }).catch(console.error);
      }
      return originalJson(body);
    };
    next();
  };
};

function sanitizeBody(body: any): any {
  if (!body) return undefined;
  const sanitized = { ...body };
  const sensitiveKeys = ['password', 'secret', 'token', 'key'];
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

interface AuthRequest extends Request {
  user?: { id: string; role: string };
}
