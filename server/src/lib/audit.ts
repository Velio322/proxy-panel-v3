import { PrismaClient, AuditAction } from '@prisma/client';
import { getPrisma } from './prisma';

export async function createAuditLog(data: {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        details: data.details,
        ip: data.ip,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    console.error('[AuditLog] Failed to create audit log:', error);
  }
}

export async function getAuditLogs(params: {
  userId?: string;
  resource?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) {
  const prisma = getPrisma();
  const { userId, resource, action, startDate, endDate, page = 1, limit = 50 } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (userId) where.userId = userId;
  if (resource) where.resource = resource;
  if (action) where.action = action;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, username: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, pages: Math.ceil(total / limit) };
}
