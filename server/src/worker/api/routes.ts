import { Router, Request, Response, NextFunction } from 'express';
import { ProcessManager } from '../process-manager';
import { config } from '../../config';

export function createWorkerAPI(pm: ProcessManager): Router {
  const router = Router();

  // Auth middleware
  router.use((req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    const nodeSecret = req.headers['x-node-secret'];

    if (auth === `Bearer ${config.worker.nodeSecret}` ||
        nodeSecret === config.worker.nodeSecret) {
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized' });
  });

  // ──── Status ────

  router.get('/api/status', (_req, res) => {
    res.json(pm.getStatus());
  });

  // ──── Config Management ────

  router.post('/api/config', (req, res) => {
    try {
      const { inbounds } = req.body;
      if (!Array.isArray(inbounds)) {
        return res.status(400).json({ error: 'inbounds must be an array' });
      }

      const success = pm.applyConfig(inbounds);
      res.json({ success, timestamp: Date.now() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/restart', (_req, res) => {
    try {
      const success = pm.restart();
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/stop', (_req, res) => {
    pm.stopAll();
    res.json({ success: true });
  });

  // ──── Traffic Stats ────

  router.get('/api/traffic', (_req, res) => {
    res.json(pm.getTrafficStats());
  });

  // ──── Metrics (for Prometheus) ────

  router.get('/api/metrics', (_req, res) => {
    const status = pm.getStatus();
    const traffic = pm.getTrafficStats();

    // Aggregate traffic
    let totalUpload = 0;
    let totalDownload = 0;
    for (const user of Object.values(traffic)) {
      totalUpload += user.upload;
      totalDownload += user.download;
    }

    res.json({
      ...status,
      traffic: { total: { upload: totalUpload, download: totalDownload }, perUser: traffic },
    });
  });

  // ──── Inbounds ────

  router.get('/api/inbounds', (_req, res) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(config.worker.configDir, 'xray.json');
      if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        res.json(cfg.inbounds || []);
      } else {
        res.json([]);
      }
    } catch {
      res.json([]);
    }
  });

  return router;
}
