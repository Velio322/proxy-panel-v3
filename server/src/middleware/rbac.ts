import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { AuthRequest, AuthUser } from '../types';

export type { AuthRequest } from '../types';

// ══════════════════════════════════════════════
// RBAC (Role-Based Access Control) Middleware
// ══════════════════════════════════════════════

/**
 * Role Hierarchy:
 *   SUPER_ADMIN > ADMIN > RESELLER > OPERATOR
 *
 * Permission Matrix:
 * ┌─────────────────┬────────┬───────┬─────────┬──────────┐
 * │ Resource        │ SUPER  │ ADMIN │ RESELLER│ OPERATOR │
 * ├─────────────────┼────────┼───────┼─────────┼──────────┤
 * │ Users (all)     │ CRUD   │ CRU-D │ —       │ —        │
 * │ Users (own)     │ CRUD   │ CRUD  │ —       │ —        │
 * │ Clients (all)   │ CRUD   │ CRUD  │ —       │ —        │
 * │ Clients (own)   │ CRUD   │ CRUD  │ CRUD    │ R        │
 * │ Nodes (all)     │ CRUD   │ CRUD  │ —       │ —        │
 * │ Nodes (own)     │ CRUD   │ CRUD  │ R       │ R        │
 * │ Inbounds (all)  │ CRUD   │ CRUD  │ —       │ R        │
 * │ Plans           │ CRUD   │ CRUD  │ R       │ R        │
 * │ Billing         │ CRUD   │ R     │ R       │ —        │
 * │ Audit Logs      │ CRUD   │ R     │ —       │ —        │
 * │ Settings        │ CRUD   │ —     │ —       │ —        │
 * │ Dashboard       │ R      │ R     │ R (own) │ R (own)  │
 * │ White-label     │ CRUD   │ —     │ —       │ —        │
 * │ Backups         │ CRUD   │ —     │ —       │ —        │
 * └─────────────────┴────────┴───────┴─────────┴──────────┘
 */

const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  RESELLER: 2,
  OPERATOR: 1,
};

// ──── Auth Middleware ────

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

// ──── Role Middleware ────

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

// ──── Resource-Level Access Control ────

/**
 * Check if the current user can access a specific resource.
 * SUPER_ADMIN/ADMIN: full access
 * RESELLER: only own resources (filtered by resellerId)
 * OPERATOR: read-only on assigned resources
 */
export const requireResourceAccess = (resourceType: string, action: 'read' | 'write' | 'delete') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { role } = req.user;

    // Super Admin and Admin have full access
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      (req as any).scope = null;
      return next();
    }

    // Reseller: scoped to own resources
    if (role === 'RESELLER') {
      if (action === 'read') {
        (req as any).scope = { resellerId: req.user.resellerId };
        return next();
      }
      // Write/Delete requires admin for most resources
      if (['settings', 'audit', 'backup', 'resellers'].includes(resourceType)) {
        return res.status(403).json({ error: 'Forbidden: reseller cannot modify this resource' });
      }
      // Resellers can write clients, plans (limited), own data
      if (['clients', 'plans', 'nodes'].includes(resourceType)) {
        (req as any).scope = { resellerId: req.user.resellerId };
        return next();
      }
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }

    // Operator: read-only
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

// ──── Reseller Scope Middleware ────

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

/**
 * Build a Prisma where clause based on the user's role and scope.
 * SUPER_ADMIN/ADMIN: no filter
 * RESELLER: filter by resellerId
 * OPERATOR: no data modification allowed
 */
export function buildScopeFilter(user: AuthUser, resource: string): any {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return {};
  if (user.role === 'RESELLER') {
    if (['client', 'inbound', 'subscription', 'invoice'].includes(resource)) {
      return { resellerId: user.resellerId };
    }
    if (resource === 'user') {
      return { resellerId: user.resellerId };
    }
    return {};
  }
  return {};
}

/**
 * Check if a user can perform an action on a specific resource instance.
 */
export function canAccessResource(user: AuthUser, resourceOwnerId?: string): boolean {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  if (user.role === 'RESELLER') return resourceOwnerId === user.resellerId;
  return false;
}
