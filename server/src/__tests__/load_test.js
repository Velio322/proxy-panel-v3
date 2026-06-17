/**
 * Load Test Script — simulates 10,000+ concurrent Worker connections
 * reporting traffic statistics to the Master server.
 *
 * Usage: node load_test.js [--workers 100] [--interval 60] [--duration 300]
 */

const http = require('http');
const https = require('https');

// ──── Configuration ────

const CONFIG = {
  masterUrl: process.env.MASTER_URL || 'http://localhost:3000',
  nodeSecret: process.env.NODE_RPC_SECRET || 'test-secret',
  workerCount: parseInt(process.env.WORKER_COUNT || '50'),
  reportsPerWorker: parseInt(process.env.REPORTS_PER_WORKER || '200'),
  reportIntervalMs: parseInt(process.env.REPORT_INTERVAL_MS || '1000'),
  durationSec: parseInt(process.env.DURATION_SEC || '60'),
};

// ──── Stats ────

let totalRequests = 0;
let successCount = 0;
let errorCount = 0;
let timeoutCount = 0;
const latencies = [];
let startTime;

// ──── Worker Simulation ────

class FakeWorker {
  constructor(id) {
    this.id = id;
    this.emails = Array.from({ length: 20 }, (_, i) => `user${id}_${i}@panel`);
    this.running = false;
    this.interval = null;
  }

  start() {
    this.running = true;
    this.interval = setInterval(() => this.report(), CONFIG.reportIntervalMs);
  }

  stop() {
    this.running = false;
    if (this.interval) clearInterval(this.interval);
  }

  report() {
    if (!this.running) return;

    // Generate fake traffic for random users
    const stats = {};
    const userCount = Math.floor(Math.random() * 10) + 1;

    for (let i = 0; i < userCount; i++) {
      const email = this.emails[Math.floor(Math.random() * this.emails.length)];
      stats[email] = {
        upload: Math.floor(Math.random() * 1024 * 1024 * 50),  // 0-50MB
        download: Math.floor(Math.random() * 1024 * 1024 * 200), // 0-200MB
      };
    }

    const body = JSON.stringify({ stats });
    const start = Date.now();

    const url = new URL(`${CONFIG.masterUrl}/api/v1/nodes/self/traffic`);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.nodeSecret}`,
        'X-Node-Secret': CONFIG.nodeSecret,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 5000,
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const latency = Date.now() - start;
        latencies.push(latency);
        totalRequests++;

        if (res.statusCode >= 200 && res.statusCode < 300) {
          successCount++;
        } else if (res.statusCode === 429) {
          timeoutCount++;
        } else {
          errorCount++;
          if (errorCount <= 10) {
            console.error(`  ✗ Worker ${this.id}: HTTP ${res.statusCode} (${data.substring(0, 100)})`);
          }
        }
      });
    });

    req.on('error', (err) => {
      totalRequests++;
      errorCount++;
    });

    req.on('timeout', () => {
      req.destroy();
      totalRequests++;
      timeoutCount++;
    });

    req.write(body);
    req.end();
  }
}

// ──── Test Runner ────

async function runLoadTest() {
  console.log('═══════════════════════════════════════════');
  console.log('  ProxPanel Load Test');
  console.log('═══════════════════════════════════════════');
  console.log(`  Master:     ${CONFIG.masterUrl}`);
  console.log(`  Workers:    ${CONFIG.workerCount}`);
  console.log(`  Reports/s:  ${CONFIG.workerCount * (1000 / CONFIG.reportIntervalMs)}`);
  console.log(`  Duration:   ${CONFIG.durationSec}s`);
  console.log('═══════════════════════════════════════════\n');

  // Start workers
  const workers = [];
  for (let i = 0; i < CONFIG.workerCount; i++) {
    workers.push(new FakeWorker(i));
  }

  startTime = Date.now();
  workers.forEach((w) => w.start());

  console.log(`Started ${CONFIG.workerCount} workers`);

  // Progress reporting
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rps = totalRequests / elapsed;
    const p50 = getPercentile(latencies, 50);
    const p95 = getPercentile(latencies, 95);
    const p99 = getPercentile(latencies, 99);

    process.stdout.write(
      `\r  [${elapsed.toFixed(0)}s] Requests: ${totalRequests} | ` +
      `Success: ${successCount} | Errors: ${errorCount} | Timeouts: ${timeoutCount} | ` +
      `RPS: ${rps.toFixed(0)} | ` +
      `P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms`
    );
  }, 1000);

  // Wait for duration
  await new Promise((resolve) => setTimeout(resolve, CONFIG.durationSec * 1000));

  // Stop workers
  workers.forEach((w) => w.stop());
  clearInterval(progressInterval);

  // Final report
  const elapsed = (Date.now() - startTime) / 1000;
  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const p50 = getPercentile(latencies, 50);
  const p95 = getPercentile(latencies, 95);
  const p99 = getPercentile(latencies, 99);

  console.log('\n\n═══════════════════════════════════════════');
  console.log('  LOAD TEST RESULTS');
  console.log('═══════════════════════════════════════════');
  console.log(`  Duration:       ${elapsed.toFixed(1)}s`);
  console.log(`  Total Requests: ${totalRequests}`);
  console.log(`  Success:        ${successCount} (${(successCount / totalRequests * 100).toFixed(1)}%)`);
  console.log(`  Errors:         ${errorCount}`);
  console.log(`  Timeouts:       ${timeoutCount}`);
  console.log(`  RPS:            ${(totalRequests / elapsed).toFixed(1)}`);
  console.log(`  Avg Latency:    ${avgLatency.toFixed(0)}ms`);
  console.log(`  P50 Latency:    ${p50}ms`);
  console.log(`  P95 Latency:    ${p95}ms`);
  console.log(`  P99 Latency:    ${p99}ms`);
  console.log('═══════════════════════════════════════════');

  // Verdict
  if (successCount / totalRequests > 0.99 && p95 < 500) {
    console.log('\n  ✅ PASS — System handles load within acceptable limits');
  } else if (successCount / totalRequests > 0.95 && p95 < 1000) {
    console.log('\n  ⚠️ WARN — Performance degraded under load');
  } else {
    console.log('\n  ❌ FAIL — System cannot handle production load');
  }
}

function getPercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p / 100);
  return sorted[idx];
}

// ──── Entry Point ────

runLoadTest().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
