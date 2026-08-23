import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, AuthUser } from '../types';

export type { AuthRequest } from '../types';

const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  RESELLER: 2,
  OPERATOR: 1,
};

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as AuthUser;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
    next();
  };
};

export const requireSuperAdmin = requireRole('SUPER_ADMIN');
export const requireAdmin = requireRole('SUPER_ADMIN', 'ADMIN');
export const requireReseller = requireRole('SUPER_ADMIN', 'ADMIN', 'RESELLER');

export const requireResourceAccess = (resourceType: string, action: 'read' | 'write' | 'delete') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { role } = req.user;

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      (req as any).scope = null;
      return next();
    }

    if (role === 'RESELLER') {
      if (action === 'read') {
        (req as any).scope = { resellerId: req.user.resellerId };
        return next();
      }
      if (['settings', 'audit', 'backup', 'resellers'].includes(resourceType)) {
        return res.status(403).json({ error: 'Forbidden: reseller cannot modify this resource' });
      }
      if (['clients', 'plans', 'nodes'].includes(resourceType)) {
        (req as any).scope = { resellerId: req.user.resellerId };
        return next();
      }
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }

    if (role === 'OPERATOR') {
      if (action !== 'read') {
        return res.status(403).json({ error: 'Forbidden: operator has read-only access' });
      }
      (req as any).scope = { role: 'OPERATOR' };
      return next();
    }

    return res.status(403).json({ error: 'Forbidden' });
  };
};

export const resellerScope = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
    (req as any).scope = null;
  } else if (req.user.role === 'RESELLER') {
    (req as any).scope = { resellerId: req.user.resellerId };
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

export function buildScopeFilter(user: AuthUser, resource: string): any {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return {};
  if (user.role === 'RESELLER') {
    if (['client', 'inbound', 'subscription', 'invoice', 'user'].includes(resource)) {
      return { resellerId: user.resellerId };
    }
    return {};
  }
  return {};
}

export function canAccessResource(user: AuthUser, resourceOwnerId?: string): boolean {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  if (user.role === 'RESELLER') return resourceOwnerId === user.resellerId;
  return false;
}
