import express from 'express';
import { config } from '../config';
import { ProcessManager } from './process-manager';
import { MasterClient } from './master-client';
import { createWorkerAPI } from './api/routes';

const WORKER_VERSION = '2.0.0';

async function main() {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║     ProxPanel Worker v${WORKER_VERSION}              ║
  ║     Multi-protocol Proxy Daemon         ║
  ╚══════════════════════════════════════════╝
  `);

  // Initialize process manager
  const pm = new ProcessManager({
    configDir: config.worker.configDir,
    xrayBin: config.worker.xrayBin,
    singboxBin: config.worker.singboxBin,
    naiveBin: config.worker.naiveBin,
    mieruBin: config.worker.mieruBin,
    haproxyEnabled: true,
  });

  // Start Express API server
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Health check (no auth)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: WORKER_VERSION, uptime: process.uptime() });
  });

  // Worker API (authenticated)
  app.use(createWorkerAPI(pm));

  const server = app.listen(config.worker.port, '0.0.0.0', () => {
    console.log(`[Worker] API server listening on port ${config.worker.port}`);
    console.log(`[Worker] Xray: ${config.worker.xrayBin}`);
    console.log(`[Worker] sing-box: ${config.worker.singboxBin}`);
    console.log(`[Worker] NaiveProxy: ${config.worker.naiveBin}`);
    console.log(`[Worker] Mieru: ${config.worker.mieruBin}`);
    console.log(`[Worker] Config dir: ${config.worker.configDir}`);
  });

  // Connect to master if configured
  if (config.worker.masterUrl) {
    const masterClient = new MasterClient({
      masterUrl: config.worker.masterUrl,
      nodeSecret: config.worker.nodeSecret,
      pollInterval: 30000, // 30 seconds
      onConfigUpdate: (inbounds) => {
        console.log(`[Worker] Received config update: ${inbounds.length} inbounds`);
        pm.applyConfig(inbounds);
      },
      onStatusReport: (status) => {
        masterClient.reportStatus(pm.getStatus());
      },
    });

    masterClient.start();

    // Report traffic stats every 60 seconds
    setInterval(() => {
      const traffic = pm.getTrafficStats();
      masterClient.reportTraffic(traffic);
    }, 60000);

    // Initial status report
    masterClient.reportStatus(pm.getStatus());
  } else {
    console.log('[Worker] No MASTER_URL configured — running in standalone mode');
    console.log('[Worker] Use POST /api/config to push configs manually');
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Worker] Shutting down...');
    pm.stopAll();
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[Worker] Uncaught exception:', error);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Worker] Unhandled rejection:', reason);
  });
}

main().catch((error) => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});
