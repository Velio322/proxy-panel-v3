import Redis from 'ioredis';
import { config } from '../config';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
    redis.on('connect', () => {
      console.log('[Redis] Connected');
    });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

// Cache helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  const data = await getRedis().get(key);
  return data ? JSON.parse(data) : null;
}

export async function cacheSet(key: string, value: any, ttlSeconds?: number): Promise<void> {
  const serialized = JSON.stringify(value);
  if (ttlSeconds) {
    await getRedis().setex(key, ttlSeconds, serialized);
  } else {
    await getRedis().set(key, serialized);
  }
}

export async function cacheDel(key: string): Promise<void> {
  await getRedis().del(key);
}

export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  const keys = await getRedis().keys(pattern);
  if (keys.length > 0) {
    await getRedis().del(...keys);
  }
}

// Real-time stats
export async function incrTrafficStat(nodeId: string, clientId: string, direction: 'upload' | 'download', bytes: number): Promise<void> {
  const r = getRedis();
  const now = new Date();
  const hourKey = `traffic:${nodeId}:${now.toISOString().slice(0, 13)}:${direction}`;
  const dayKey = `traffic:${nodeId}:${now.toISOString().slice(0, 10)}:${direction}`;
  const clientDayKey = `client_traffic:${clientId}:${now.toISOString().slice(0, 10)}:${direction}`;

  const pipeline = r.pipeline();
  pipeline.incrbyfloat(hourKey, bytes);
  pipeline.expire(hourKey, 86400 * 2);
  pipeline.incrbyfloat(dayKey, bytes);
  pipeline.expire(dayKey, 86400 * 7);
  pipeline.incrbyfloat(clientDayKey, bytes);
  pipeline.expire(clientDayKey, 86400 * 30);
  await pipeline.exec();
}

export async function getTrafficStat(key: string): Promise<number> {
  const val = await getRedis().get(key);
  return val ? parseFloat(val) : 0;
}

// Queue for background tasks
export async function enqueueTask(queue: string, payload: any): Promise<void> {
  await getRedis().lpush(`queue:${queue}`, JSON.stringify(payload));
}

export async function dequeueTask(queue: string): Promise<any | null> {
  const data = await getRedis().rpop(`queue:${queue}`);
  return data ? JSON.parse(data) : null;
}
