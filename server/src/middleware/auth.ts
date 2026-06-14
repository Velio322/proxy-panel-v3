import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, AuthUser } from '../types';

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
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
    next();
  };
};

export const requireSuperAdmin = requireRole('SUPER_ADMIN');
export const requireAdmin = requireRole('SUPER_ADMIN', 'ADMIN');
export const requireReseller = requireRole('SUPER_ADMIN', 'ADMIN', 'RESELLER');

export const resellerScope = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
    (req as any).scope = null; // no filter — sees everything
  } else if (req.user.role === 'RESELLER') {
    (req as any).scope = { resellerId: req.user.resellerId };
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
