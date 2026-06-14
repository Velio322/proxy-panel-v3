import dotenv from 'dotenv';
dotenv.config();

export const config = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/proxpanel',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  master: {
    port: parseInt(process.env.API_PORT || '3000', 10),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    apiUrl: process.env.API_URL || 'http://localhost:3000',
  },
  worker: {
    port: parseInt(process.env.WORKER_PORT || '2087', 10),
    configDir: process.env.CONFIG_DIR || '/etc/proxpanel',
    xrayBin: process.env.XRAY_BIN || '/usr/local/bin/xray',
    singboxBin: process.env.SINGBOX_BIN || '/usr/local/bin/sing-box',
    naiveBin: process.env.NAIVE_BIN || '/usr/local/bin/naive',
    mieruBin: process.env.MIERU_BIN || '/usr/local/bin/mieru',
    masterUrl: process.env.MASTER_URL || '',
    nodeSecret: process.env.NODE_RPC_SECRET || '',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    adminIds: (process.env.TELEGRAM_ADMIN_IDS || '').split(',').filter(Boolean).map(Number),
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    telegramBotToken: process.env.BACKUP_TELEGRAM_TOKEN || '',
    telegramChatId: process.env.BACKUP_TELEGRAM_CHAT_ID || '',
    s3Bucket: process.env.BACKUP_S3_BUCKET || '',
    s3Region: process.env.BACKUP_S3_REGION || '',
    s3AccessKey: process.env.BACKUP_S3_ACCESS_KEY || '',
    s3SecretKey: process.env.BACKUP_S3_SECRET_KEY || '',
    interval: process.env.BACKUP_INTERVAL || '0 3 * * *', // daily at 3am
  },
  billing: {
    cryptopayToken: process.env.CRYPTOPAY_TOKEN || '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    telegramStarsToken: process.env.TELEGRAM_STARS_TOKEN || '',
  },
  prometheus: {
    enabled: process.env.PROMETHEUS_ENABLED !== 'false',
    port: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
};
