import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
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
import planRoutes from '../routes/plans';
import billingRoutes from '../routes/billing';
import resellerRoutes from '../routes/resellers';
import auditRoutes from '../routes/audit';
import settingsRoutes from '../routes/settings';
import backupRoutes from '../routes/backup';
import nodeApiRoutes from '../routes/node-api';
import { initTelegramBot, stopTelegramBot } from '../services/telegramBot';
import { startScheduler } from '../services/scheduler';

const app = express();

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
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Stricter auth rate limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts' },
});

// Body parser
app.use(express.json({ limit: '10mb' }));

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
app.use('/api/v1/plans', planRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/resellers', resellerRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/backup', backupRoutes);

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

async function startServer() {
  try {
    const prisma = getPrisma();
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL');

    getRedis();
    console.log('[Redis] Connected');

    initTelegramBot();
    startScheduler();

    app.listen(config.master.port, () => {
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
  await closeRedis();
  await closePrisma();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Master] Shutting down...');
  stopTelegramBot();
  await closeRedis();
  await closePrisma();
  process.exit(0);
});

startServer();
