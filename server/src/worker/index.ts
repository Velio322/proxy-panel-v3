import express from 'express';
import http from 'http';
import os from 'os';
import { config } from '../config';
import path from 'path';
import { ProcessManager } from './process-manager';
import { MasterClient } from './master-client';
import { createWorkerAPI } from './api/routes';

const WORKER_VERSION = '2.0.0';

async function registerNode(masterUrl: string, nodeSecret: string): Promise<void> {
  const url = `${masterUrl}/api/v1/nodes/self/register`;
  const payload = JSON.stringify({
    token: nodeSecret,
    name: os.hostname() || `node-${Date.now()}`,
    host: '0.0.0.0',
    port: 443,
    apiPort: config.worker.port,
    system: { release: WORKER_VERSION },
  });

  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const parsed = new URL(url);
        const req = http.request({
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)) },
          timeout: 5000,
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`[Worker] Registered with master: ${data}`);
              resolve();
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.write(payload);
        req.end();
      });
      return;
    } catch (err: any) {
      console.log(`[Worker] Register attempt ${attempt}/30 failed: ${err.message}`);
      if (attempt < 30) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  console.error('[Worker] Failed to register after 30 attempts');
}

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
    binDir: path.dirname(config.worker.xrayBin),
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

  let masterClient: MasterClient | null = null;

  // Connect to master if configured
  if (config.worker.masterUrl) {
    // Register node with master before connecting WebSocket
    await registerNode(config.worker.masterUrl, config.worker.nodeSecret);

    masterClient = new MasterClient({
      masterUrl: config.worker.masterUrl,
      nodeSecret: config.worker.nodeSecret,
      pollInterval: 30000, // 30 seconds for status report
      onConfigUpdate: (inbounds) => {
        console.log(`[Worker] Received config update via WS: ${inbounds.length} inbounds`);
        pm.applyConfig(inbounds);
      },
      onStatusReport: () => {
        if (masterClient) {
          masterClient.reportStatus(pm.getStatus());
        }
      },
    });

    masterClient.start();

    // Report traffic stats every 60 seconds
    setInterval(async () => {
      if (masterClient) {
        const traffic = pm.getTrafficStats();
        await masterClient.reportTraffic(traffic);
      }
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
    if (masterClient) masterClient.stop();
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
