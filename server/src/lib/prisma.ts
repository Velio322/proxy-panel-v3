import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../config';

let prisma: PrismaClient | null = null;

/**
 * Get Prisma client with optimized connection pool.
 *
 * Connection pool sizing:
 *   connection_limit = CPU cores * 2 + disk_spindles
 *   For SSD server: 4 cores × 2 + 1 = 9 connections
 *   PostgreSQL default max_connections = 100
 *   With 5 app instances: 5 × 9 = 45 connections (safe)
 *
 * The pool_timeout is set to 10s to prevent indefinite blocking.
 */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    // Append connection_limit to DATABASE_URL if not present
    const separator = config.database.url.includes('?') ? '&' : '?';
    const dbUrl = config.database.url.includes('connection_limit')
      ? config.database.url
      : `${config.database.url}${separator}connection_limit=12&pool_timeout=10`;

    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });

    console.log('[Prisma] Initialized with connection_limit=12, pool_timeout=10s');
  }
  return prisma;
}

export async function closePrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    console.log('[Prisma] Disconnected');
  }
}

export function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));
}

/**
 * Execute a raw query with timeout protection.
 * Prevents slow queries from blocking the event loop.
 */
export async function queryWithTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Query timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    queryFn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Execute a database operation with retry logic.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Only retry on transient errors (connection, timeout)
      if (error.code === 'P1001' || error.code === 'P1008' || error.message?.includes('timeout')) {
        console.warn(`[Prisma] Retry ${i + 1}/${maxRetries}: ${error.message}`);
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}
