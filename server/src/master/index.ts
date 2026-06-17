import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { register } from 'prom-client';
import { config } from '../config';
import { getPrisma, closePrisma } from '../lib/prisma';
import { getRedis, closeRedis } from '../lib/redis';
import { httpRequestsTotal, httpRequestDuration } from '../metrics';
import authRoutes from '../routes/auth';
import userRoutes from '../routes/users';
import clientRoutes from '../routes/clients';
import nodeRoutes from '../routes/nodes';
import inboundRoutes from '../routes/inbounds';
import dashboardRoutes from '../routes/dashboard';
import subRoutes from '../routes/sub';
import resellerRoutes from '../routes/resellers';
import auditRoutes from '../routes/audit';
import settingsRoutes from '../routes/settings';
import backupRoutes from '../routes/backup';
import routingRoutes from '../routes/routing';
import nodeApiRoutes from '../routes/node-api';
import { initTelegramBot, stopTelegramBot } from '../services/telegramBot';
import { startScheduler } from '../services/scheduler';
import { getTrafficBatcher } from '../lib/traffic-batcher';
import { createServer } from 'http';
import { getWorkerSocketManager } from '../ws/worker-socket';

const app = express();
const server = createServer(app);

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: config.master.frontendUrl,
  credentials: true,
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Stricter auth rate limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts' },
});

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    httpRequestsTotal.inc({ method: req.method, route, status: res.statusCode });
    httpRequestDuration.observe({ method: req.method, route }, duration);
  });
  next();
});

// Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/nodes', nodeRoutes);
app.use('/api/v1/inbounds', inboundRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/client', subRoutes);
app.use('/api/v1/resellers', resellerRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/backup', backupRoutes);
app.use('/api/v1/routing', routingRoutes);

// Node-to-Master API (worker daemons poll this)
app.use('/api/v1/nodes/self', nodeApiRoutes);

// Prometheus metrics
if (config.prometheus.enabled) {
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch {
      res.status(500).end();
    }
  });
}

// Serve frontend static files (only if client/dist exists — in Docker it's a separate container)
const clientDist = path.resolve(__dirname, '../../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    const redis = getRedis();
    await redis.ping();
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' });
  } catch (error: any) {
    res.status(503).json({ status: 'error', error: error.message });
  }
});

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

async function startServer() {
  // Retry DB connection — entrypoint may still be running db push
  const MAX_RETRIES = 15;
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const prisma = getPrisma();
      await prisma.$connect();
      console.log('[DB] Connected to PostgreSQL');
      break;
    } catch (error: any) {
      retries++;
      console.warn(`[DB] Connection attempt ${retries}/${MAX_RETRIES} failed: ${error.message}`);
      if (retries >= MAX_RETRIES) {
        console.error('[Master] Could not connect to database after max retries. Exiting.');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  try {
    getRedis();
    console.log('[Redis] Connected');

    initTelegramBot();
    startScheduler();

    // Initialize Worker WebSocket Manager
    const wsManager = getWorkerSocketManager();
    wsManager.init(server);

    // Start traffic batcher (accumulates writes, flushes to DB periodically)
    const batcher = getTrafficBatcher();
    batcher.start();
    batcher.on('flushed', ({ count }) => console.log(`[Batcher] Flushed ${count} traffic entries`));
    batcher.on('error', (err) => console.error(`[Batcher] Error: ${err.message}`));

    server.listen(config.master.port, '0.0.0.0', () => {
      console.log(`[Master] API server running on port ${config.master.port}`);
      if (config.prometheus.enabled) {
        console.log(`[Metrics] Prometheus endpoint on /metrics`);
      }
    });
  } catch (error) {
    console.error('[Master] Failed to start:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('[Master] Shutting down...');
  stopTelegramBot();
  const batcher = getTrafficBatcher();
  await batcher.stop();
  await closeRedis();
  await closePrisma();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Master] Shutting down...');
  stopTelegramBot();
  const batcher = getTrafficBatcher();
  await batcher.stop();
  await closeRedis();
  await closePrisma();
  process.exit(0);
});

startServer();
