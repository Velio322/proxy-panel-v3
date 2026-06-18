import { getPrisma } from '../lib/prisma';
import { getRedis } from '../lib/redis';
import { EventEmitter } from 'events';

interface TrafficEntry {
  clientId: string;
  nodeId: string;
  upload: number;
  download: number;
  protocol?: string;
  inboundTag?: string;
  recordAt: Date;
}

interface PendingTraffic {
  clientId: string;
  nodeId: string;
  upload: number;
  download: number;
}

/**
 * TrafficBatcher — accumulates traffic writes in Redis, flushes to PostgreSQL in bulk.
 *
 * Problem: 10K users × 1 report/min = 166 individual INSERT/sec → DB overload.
 * Solution: Accumulate in Redis sorted sets, flush every N seconds as single bulk INSERT.
 *
 * Write path: TrafficReport → Redis ZINCRBY → (every 30s) → Prisma createMany → PostgreSQL
 */
export class TrafficBatcher extends EventEmitter {
  private flushIntervalMs: number;
  private maxBatchSize: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing: boolean = false;
  private flushCount: number = 0;
  private totalFlushed: number = 0;

  constructor(options?: { flushIntervalMs?: number; maxBatchSize?: number }) {
    super();
    this.flushIntervalMs = options?.flushIntervalMs || 30000; // 30 seconds
    this.maxBatchSize = options?.maxBatchSize || 5000;
  }

  /**
   * Start the periodic flush timer.
   */
  start(): void {
    this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
    console.log(`[TrafficBatcher] Started (flush every ${this.flushIntervalMs / 1000}s, max batch: ${this.maxBatchSize})`);
  }

  /**
   * Stop the flush timer and flush remaining data.
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    console.log(`[TrafficBatcher] Stopped (flushed ${this.totalFlushed} entries)`);
  }

  /**
   * Accumulate traffic data in Redis.
   * Called by node-api.ts when worker reports traffic.
   */
  async accumulate(entries: TrafficEntry[]): Promise<void> {
    const r = getRedis();
    const pipeline = r.pipeline();

    for (const entry of entries) {
      const now = Date.now();

      // Store as JSON in a Redis sorted set (score = timestamp)
      const data = JSON.stringify({
        clientId: entry.clientId,
        nodeId: entry.nodeId,
        upload: Number(entry.upload),
        download: Number(entry.download),
        protocol: entry.protocol,
        inboundTag: entry.inboundTag,
      });

      pipeline.zadd(`traffic_pending:${entry.nodeId}`, now, `${entry.clientId}:${data}`);
      pipeline.zadd('traffic_pending_keys', now, entry.nodeId);
    }

    await pipeline.exec();
  }

  private emailToIdCache = new Map<string, string>();

  /**
   * Add traffic data by email (resolves email to clientId).
   * Supports both BigInt and number for traffic values.
   */
  async add(data: { nodeId: string; email: string; upload: bigint | number; download: bigint | number; protocol?: string; inboundTag?: string }): Promise<void> {
    try {
      let cachedId = this.emailToIdCache.get(data.email);
      let clientId: string;

      if (!cachedId) {
        const prisma = getPrisma();
        const client = await prisma.client.findFirst({
          where: {
            OR: [
              { email: data.email },
              { username: data.email }
            ]
          },
          select: { id: true }
        });

        if (!client) {
          // Silent skip or log unknown client
          return;
        }

        clientId = client.id;
        this.emailToIdCache.set(data.email, clientId);
        
        // Limit cache size
        if (this.emailToIdCache.size > 10000) {
          const firstKey = this.emailToIdCache.keys().next().value;
          if (firstKey) this.emailToIdCache.delete(firstKey);
        }
      } else {
        clientId = cachedId;
      }

      await this.accumulate([{
        clientId,
        nodeId: data.nodeId,
        upload: Number(data.upload),
        download: Number(data.download),
        protocol: data.protocol as any,
        inboundTag: data.inboundTag,
        recordAt: new Date()
      }]);
    } catch (error: any) {
      console.error(`[TrafficBatcher] Add error: ${error.message}`);
    }
  }

  /**
   * Flush accumulated traffic to PostgreSQL.
   * Uses bulk INSERT to minimize DB round-trips.
   */
  async flush(): Promise<void> {
    if (this.isFlushing) return;
    this.isFlushing = true;

    try {
      const r = getRedis();
      const prisma = getPrisma();

      // Get all pending node keys
      const nodeKeys = await r.zrange('traffic_pending_keys', 0, -1);
      if (nodeKeys.length === 0) {
        this.isFlushing = false;
        return;
      }

      let totalFlushed = 0;
      const allEntries: TrafficEntry[] = [];

      // Process each node's pending traffic
      for (const nodeId of nodeKeys) {
        const pendingKey = `traffic_pending:${nodeId}`;
        const items = await r.zrangebyscore(pendingKey, '-inf', '+inf');

        if (items.length === 0) continue;

        // Aggregate by client (sum up multiple reports for same client)
        const clientAgg = new Map<string, { clientId: string; upload: number; download: number; protocol?: string; inboundTag?: string }>();

        for (const item of items) {
          try {
            const data = JSON.parse(item.split(':').slice(1).join(':'));
            const existing = clientAgg.get(data.clientId);
            if (existing) {
              existing.upload += data.upload;
              existing.download += data.download;
            } else {
              clientAgg.set(data.clientId, { ...data });
            }
          } catch {}
        }

        // Convert to TrafficEntry
        const now = new Date();
        for (const [, agg] of clientAgg) {
          if (agg.upload === 0 && agg.download === 0) continue;
          allEntries.push({
            clientId: agg.clientId,
            nodeId,
            upload: agg.upload,
            download: agg.download,
            protocol: agg.protocol,
            inboundTag: agg.inboundTag,
            recordAt: now,
          });
        }

        // Clear processed items from Redis
        await r.zremrangebyscore(pendingKey, '-inf', '+inf');
        await r.zrem('traffic_pending_keys', nodeId);
      }

      // Bulk INSERT to PostgreSQL (single query for all entries)
      if (allEntries.length > 0) {
        const batch = allEntries.slice(0, this.maxBatchSize);

        // Use Prisma's createMany for bulk insert
        await prisma.trafficLog.createMany({
          data: batch.map((e) => ({
            clientId: e.clientId,
            nodeId: e.nodeId,
            upload: BigInt(e.upload),
            download: BigInt(e.download),
            protocol: e.protocol as any,
            inboundTag: e.inboundTag,
            recordAt: e.recordAt,
          })),
          skipDuplicates: true,
        });

        // Update client cumulative counters
        const clientUpdates = new Map<string, { upload: number; download: number }>();
        for (const entry of batch) {
          const existing = clientUpdates.get(entry.clientId);
          if (existing) {
            existing.upload += entry.upload;
            existing.download += entry.download;
          } else {
            clientUpdates.set(entry.clientId, { upload: entry.upload, download: entry.download });
          }
        }

        // Batch update clients
        const updatePromises: Promise<any>[] = [];
        for (const [clientId, traffic] of clientUpdates) {
          const totalTraffic = BigInt(traffic.upload) + BigInt(traffic.download);
          updatePromises.push(
            prisma.client.update({
              where: { id: clientId },
              data: {
                usedTraffic: { increment: totalTraffic },
                uploadTraffic: { increment: BigInt(traffic.upload) },
                downloadTraffic: { increment: BigInt(traffic.download) },
                lastActiveAt: new Date(),
              },
            }).catch(() => {}) // Silently skip if client not found
          );
        }

        // Execute client updates in parallel (max 100 concurrent)
        const CHUNK_SIZE = 100;
        for (let i = 0; i < updatePromises.length; i += CHUNK_SIZE) {
          await Promise.all(updatePromises.slice(i, i + CHUNK_SIZE));
        }

        totalFlushed = batch.length;
        this.totalFlushed += totalFlushed;
        this.flushCount++;

        this.emit('flushed', { count: totalFlushed, timestamp: new Date() });
        console.log(`[TrafficBatcher] Flush #${this.flushCount}: ${totalFlushed} entries`);
      }
    } catch (error: any) {
      console.error(`[TrafficBatcher] Flush error: ${error.message}`);
      this.emit('error', error);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Get current batch stats.
   */
  async getStats(): Promise<{ pendingEntries: number; flushCount: number; totalFlushed: number }> {
    const r = getRedis();
    const keys = await r.zrange('traffic_pending_keys', 0, -1);
    let pending = 0;
    for (const nodeId of keys) {
      pending += await r.zcard(`traffic_pending:${nodeId}`);
    }
    return { pendingEntries: pending, flushCount: this.flushCount, totalFlushed: this.totalFlushed };
  }
}

// Singleton
let batcher: TrafficBatcher | null = null;

export function getTrafficBatcher(): TrafficBatcher {
  if (!batcher) {
    batcher = new TrafficBatcher();
  }
  return batcher;
}
