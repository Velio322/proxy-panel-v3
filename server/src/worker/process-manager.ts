import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { EventEmitter } from 'events';
import os from 'os';
import { InboundConfig, NodeStatus } from './types';
import { XrayManager } from './core/xray';
import { SingboxManager } from './core/singbox';
import { NaiveManager } from './core/naive';
import { MieruManager } from './core/mieru';
import { SNIRouter } from './port-sharing/sni-router';

// ══════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════

interface ProcessState {
  name: string;
  process: ChildProcess | null;
  pid: number | null;
  running: boolean;
  startedAt: Date | null;
  restartCount: number;
  lastExitCode: number | null;
  lastError: string | null;
  lastStderrLines: string[];
  configPath: string;
}

interface CoreAlert {
  core: string;
  type: 'crash' | 'start_failed' | 'port_conflict' | 'cert_error' | 'config_error' | 'unknown';
  message: string;
  stderr: string[];
  timestamp: Date;
  pid: number | null;
}

interface BinaryInfo {
  name: string;
  currentPath: string;
  version: string | null;
  githubRepo: string;
  assetPattern: string;
}

// ══════════════════════════════════════════════
// Log Ring Buffer
// ══════════════════════════════════════════════

class RingBuffer<T> {
  private buffer: T[] = [];
  private maxSize: number;

  constructor(maxSize: number = 500) {
    this.maxSize = maxSize;
  }

  push(item: T): void {
    this.buffer.push(item);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getAll(): T[] {
    return [...this.buffer];
  }

  getLast(n: number): T[] {
    return this.buffer.slice(-n);
  }

  clear(): void {
    this.buffer = [];
  }

  get length(): number {
    return this.buffer.length;
  }
}

// ══════════════════════════════════════════════
// Binary Auto-Fetcher
// ══════════════════════════════════════════════

const GITHUB_API = 'https://api.github.com';

async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'ProxPanel-Worker/2.0', 'Accept': 'application/vnd.github.v3+json' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return fetchJson(res.headers.location!).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const request = mod.get(url, { headers: { 'User-Agent': 'ProxPanel-Worker/2.0' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return downloadFile(res.headers.location!, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const file = createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    });
    request.on('error', reject);
  });
}

async function fetchLatestRelease(repo: string): Promise<{ tag: string; assets: Array<{ name: string; browser_download_url: string }> }> {
  const url = `${GITHUB_API}/repos/${repo}/releases/latest`;
  const data = await fetchJson(url);
  return { tag: data.tag_name, assets: data.assets || [] };
}

function findAsset(assets: Array<{ name: string; browser_download_url: string }>, pattern: string): { name: string; url: string } | null {
  const platform = os.platform();
  const arch = os.arch();

  const archMap: Record<string, string> = { x64: '64', arm64: 'arm64', arm: 'armv7' };
  const platMap: Record<string, string> = { linux: 'linux', darwin: 'macos', win32: 'windows' };

  const searchTerms = [
    platMap[platform] || 'linux',
    archMap[arch] || '64',
  ];

  for (const asset of assets) {
    const name = asset.name.toLowerCase();
    if (!name.includes(pattern.toLowerCase())) continue;
    if (searchTerms.every((t) => name.includes(t))) {
      return { name: asset.name, url: asset.browser_download_url };
    }
  }
  // Fallback: just match pattern + linux
  for (const asset of assets) {
    const name = asset.name.toLowerCase();
    if (name.includes(pattern.toLowerCase()) && name.includes('linux')) {
      return { name: asset.name, url: asset.browser_download_url };
    }
  }
  return null;
}

async function extractBinary(archivePath: string, destDir: string, binaryName: string): Promise<string> {
  const { execSync } = await import('child_process');
  const ext = path.extname(archivePath);

  if (ext === '.zip') {
    execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { timeout: 30000 });
  } else if (ext === '.gz' || archivePath.endsWith('.tar.gz')) {
    execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { timeout: 30000 });
  } else {
    // Assume it's the raw binary
    fs.copyFileSync(archivePath, path.join(destDir, binaryName));
  }

  // Find the binary
  const files = fs.readdirSync(destDir);
  const found = files.find((f) => f === binaryName || f.startsWith(binaryName));
  if (found) {
    const binPath = path.join(destDir, found);
    fs.chmodSync(binPath, 0o755);
    return binPath;
  }

  throw new Error(`Binary ${binaryName} not found after extraction`);
}

async function ensureBinary(config: {
  name: string;
  binPath: string;
  githubRepo: string;
  assetPattern: string;
  binDir: string;
}): Promise<string> {
  if (fs.existsSync(config.binPath)) {
    console.log(`[BinaryFetch] ${config.name} found at ${config.binPath}`);
    return config.binPath;
  }

  console.log(`[BinaryFetch] ${config.name} not found. Downloading from ${config.githubRepo}...`);

  try {
    const release = await fetchLatestRelease(config.githubRepo);
    console.log(`[BinaryFetch] Latest release: ${release.tag}`);

    const asset = findAsset(release.assets, config.assetPattern);
    if (!asset) {
      throw new Error(`No matching asset found for ${config.assetPattern}`);
    }

    console.log(`[BinaryFetch] Downloading ${asset.name}...`);
    const archivePath = path.join(config.binDir, asset.name);

    fs.mkdirSync(config.binDir, { recursive: true });
    await downloadFile(asset.url, archivePath);
    console.log(`[BinaryFetch] Downloaded to ${archivePath}`);

    const extractedPath = await extractBinary(archivePath, config.binDir, config.name);
    console.log(`[BinaryFetch] Extracted to ${extractedPath}`);

    // Cleanup archive
    try { fs.unlinkSync(archivePath); } catch {}

    // Rename if needed
    if (extractedPath !== config.binPath) {
      fs.renameSync(extractedPath, config.binPath);
    }

    console.log(`[BinaryFetch] ${config.name} ready at ${config.binPath}`);
    return config.binPath;
  } catch (error: any) {
    console.error(`[BinaryFetch] Failed to fetch ${config.name}: ${error.message}`);
    throw error;
  }
}

// ══════════════════════════════════════════════
// Error Parser
// ══════════════════════════════════════════════

function parseCoreError(stderrLines: string[]): CoreAlert['type'] {
  const text = stderrLines.join('\n').toLowerCase();

  if (text.includes('address already in use') || text.includes('bind: address already in use') || text.includes('listen tcp')) {
    return 'port_conflict';
  }
  if (text.includes('certificate') || text.includes('tls') || text.includes('cert') || text.includes('x509')) {
    return 'cert_error';
  }
  if (text.includes('failed to start') || text.includes('config') || text.includes('invalid') || text.includes('parse')) {
    return 'config_error';
  }
  if (text.includes('panic') || text.includes('fatal') || text.includes('segfault')) {
    return 'crash';
  }
  return 'unknown';
}

// ══════════════════════════════════════════════
// Process Manager
// ══════════════════════════════════════════════

export class ProcessManager extends EventEmitter {
  private xray: XrayManager;
  private singbox: SingboxManager;
  private naive: NaiveManager;
  private mieru: MieruManager;
  private sniRouter: SNIRouter;
  private configDir: string;
  private binDir: string;
  private startTime: number = Date.now();
  private currentInbounds: InboundConfig[] = [];

  // Process states
  private cores: Map<string, ProcessState> = new Map();

  // Log buffers (per core)
  private logBuffers: Map<string, RingBuffer<{ time: Date; stream: 'stdout' | 'stderr'; line: string }>> = new Map();

  // Alert history
  private alerts: RingBuffer<CoreAlert> = new RingBuffer(100);

  // Auto-restart config
  private maxRestarts = 5;
  private restartWindowMs = 60_000; // 1 minute
  private restartBackoffBase = 2000; // 2 seconds

  constructor(config: {
    configDir: string;
    binDir: string;
    xrayBin: string;
    singboxBin: string;
    naiveBin: string;
    mieruBin: string;
    haproxyEnabled?: boolean;
  }) {
    super();
    this.configDir = config.configDir;
    this.binDir = config.binDir;
    this.xray = new XrayManager(config.configDir, config.xrayBin);
    this.singbox = new SingboxManager(config.configDir, config.singboxBin);
    this.naive = new NaiveManager(config.configDir, config.naiveBin);
    this.mieru = new MieruManager(config.configDir, config.mieruBin);
    this.sniRouter = new SNIRouter(config.configDir, {
      haproxy: config.haproxyEnabled ?? true,
    });

    // Initialize log buffers
    for (const name of ['xray', 'singbox', 'naive', 'mieru']) {
      this.logBuffers.set(name, new RingBuffer(500));
    }
  }

  // ══════════════════════════════════════════════
  // Binary Auto-Fetch
  // ══════════════════════════════════════════════

  async fetchBinaries(): Promise<void> {
    console.log('[PM] Checking binaries...');

    const binaries: Array<{ name: string; binPath: string; githubRepo: string; assetPattern: string }> = [
      {
        name: 'xray',
        binPath: path.join(this.binDir, 'xray'),
        githubRepo: 'XTLS/Xray-core',
        assetPattern: 'Xray-linux-64',
      },
      {
        name: 'sing-box',
        binPath: path.join(this.binDir, 'sing-box'),
        githubRepo: 'SagerNet/sing-box',
        assetPattern: 'sing-box-linux-amd64',
      },
      {
        name: 'naive',
        binPath: path.join(this.binDir, 'naive'),
        githubRepo: 'klzgrad/naiveproxy',
        assetPattern: 'naiveproxy-linux',
      },
    ];

    for (const bin of binaries) {
      try {
        await ensureBinary({ ...bin, binDir: this.binDir });
      } catch (error: any) {
        console.error(`[PM] Binary fetch failed for ${bin.name}: ${error.message}`);
      }
    }
  }

  // ══════════════════════════════════════════════
  // Process Lifecycle
  // ══════════════════════════════════════════════

  applyConfig(inbounds: InboundConfig[]): boolean {
    console.log(`[PM] Applying config: ${inbounds.length} inbounds`);
    this.currentInbounds = inbounds;

    try {
      this.stopAll();

      const remappedInbounds = this.sniRouter.remapInboundPorts(inbounds);
      this.sniRouter.applyPortSharing(inbounds);

      const xrayInbounds = remappedInbounds.filter((i) =>
        ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(i.protocol) && i.enable
      );
      const singboxInbounds = remappedInbounds.filter((i) =>
        ['HYSTERIA2', 'TUIC'].includes(i.protocol) && i.enable
      );
      const naiveInbounds = remappedInbounds.filter((i) => i.protocol === 'NAIVEPROXY' && i.enable);
      const mieruInbounds = remappedInbounds.filter((i) => i.protocol === 'MIERU' && i.enable);

      let allSuccess = true;

      if (xrayInbounds.length > 0) {
        const xrayConfig = this.xray.generateConfig(xrayInbounds);
        this.xray.writeConfig(xrayConfig);
        if (!this.spawnCore('xray', this.xray)) allSuccess = false;
      }

      if (singboxInbounds.length > 0) {
        const singboxConfig = this.singbox.generateConfig(singboxInbounds);
        this.singbox.writeConfig(singboxConfig);
        if (!this.spawnCore('singbox', this.singbox)) allSuccess = false;
      }

      for (const inbound of naiveInbounds) {
        if (!this.naive.start(inbound)) allSuccess = false;
      }

      for (const inbound of mieruInbounds) {
        if (!this.mieru.start(inbound)) allSuccess = false;
      }

      console.log(`[PM] Config applied. Xray:${xrayInbounds.length} Singbox:${singboxInbounds.length} Naive:${naiveInbounds.length} Mieru:${mieruInbounds.length}`);
      return allSuccess;
    } catch (error: any) {
      console.error(`[PM] Failed to apply config: ${error.message}`);
      return false;
    }
  }

  private spawnCore(name: string, manager: XrayManager | SingboxManager): boolean {
    const configPath = path.join(this.configDir, `${name}.json`);
    const binPath = path.join(this.binDir, name);

    if (!fs.existsSync(binPath)) {
      console.error(`[PM] Binary not found: ${binPath}`);
      return false;
    }

    const state: ProcessState = {
      name,
      process: null,
      pid: null,
      running: false,
      startedAt: null,
      restartCount: 0,
      lastExitCode: null,
      lastError: null,
      lastStderrLines: [],
      configPath,
    };

    const success = manager.start();
    if (success) {
      // Hook into the manager's process for monitoring
      const proc = (manager as any).process?.process as ChildProcess | null;
      if (proc) {
        state.process = proc;
        state.pid = proc.pid || null;
        state.running = true;
        state.startedAt = new Date();
        this.attachProcessMonitor(name, state, proc);
      }
    }

    this.cores.set(name, state);
    return success;
  }

  private attachProcessMonitor(name: string, state: ProcessState, proc: ChildProcess): void {
    const logBuffer = this.logBuffers.get(name) || new RingBuffer(500);

    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n').filter(Boolean);
      for (const line of lines) {
        logBuffer.push({ time: new Date(), stream: 'stdout', line });
        this.emit('log', { core: name, stream: 'stdout', line, time: new Date() });
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n').filter(Boolean);
      for (const line of lines) {
        logBuffer.push({ time: new Date(), stream: 'stderr', line });
        state.lastStderrLines.push(line);
        if (state.lastStderrLines.length > 50) state.lastStderrLines.shift();
        this.emit('log', { core: name, stream: 'stderr', line, time: new Date() });
      }
    });

    proc.on('exit', (code, signal) => {
      state.running = false;
      state.pid = null;
      state.lastExitCode = code;

      const logBuffer2 = this.logBuffers.get(name) || new RingBuffer(500);
      logBuffer2.push({ time: new Date(), stream: 'stderr', line: `Process exited (code=${code}, signal=${signal})` });

      if (code !== 0 && code !== null) {
        const alertType = parseCoreError(state.lastStderrLines);
        const alert: CoreAlert = {
          core: name,
          type: alertType,
          message: `${name} exited with code ${code}`,
          stderr: state.lastStderrLines.slice(-10),
          timestamp: new Date(),
          pid: state.pid,
        };
        this.alerts.push(alert);
        this.emit('alert', alert);
        console.error(`[PM] ALERT: ${name} crashed (${alertType}): ${alert.message}`);

        // Auto-restart with backoff
        this.scheduleRestart(name, state);
      }
    });

    proc.on('error', (err) => {
      state.running = false;
      state.lastError = err.message;
      const alert: CoreAlert = {
        core: name,
        type: 'start_failed',
        message: `${name} spawn error: ${err.message}`,
        stderr: [err.message],
        timestamp: new Date(),
        pid: null,
      };
      this.alerts.push(alert);
      this.emit('alert', alert);
    });
  }

  private scheduleRestart(name: string, state: ProcessState): void {
    // Check restart limits
    const now = Date.now();
    if (state.restartCount >= this.maxRestarts) {
      console.error(`[PM] ${name}: Max restarts (${this.maxRestarts}) reached. Giving up.`);
      const alert: CoreAlert = {
        core: name,
        type: 'crash',
        message: `${name}: Max restart attempts exceeded (${this.maxRestarts})`,
        stderr: state.lastStderrLines.slice(-5),
        timestamp: new Date(),
        pid: null,
      };
      this.alerts.push(alert);
      this.emit('alert', alert);
      return;
    }

    // Exponential backoff
    const delay = this.restartBackoffBase * Math.pow(2, state.restartCount);
    state.restartCount++;

    console.log(`[PM] ${name}: Auto-restart #${state.restartCount} in ${delay}ms`);
    this.emit('restart', { core: name, attempt: state.restartCount, delay });

    setTimeout(() => {
      if (this.currentInbounds.length > 0) {
        console.log(`[PM] ${name}: Restarting...`);
        this.applyConfig(this.currentInbounds);
      }
    }, delay);
  }

  // ══════════════════════════════════════════════
  // Control
  // ══════════════════════════════════════════════

  restart(): boolean {
    console.log('[PM] Restarting all cores...');
    // Reset restart counters
    for (const [, state] of this.cores) {
      state.restartCount = 0;
    }
    return this.applyConfig(this.currentInbounds);
  }

  stopAll(): void {
    console.log('[PM] Stopping all cores...');
    this.xray.stop();
    this.singbox.stop();
    this.naive.stopAll();
    this.mieru.stopAll();
    for (const [, state] of this.cores) {
      state.running = false;
      state.pid = null;
    }
  }

  // ══════════════════════════════════════════════
  // Status & Monitoring
  // ══════════════════════════════════════════════

  getStatus(): NodeStatus {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const memInfo = os.totalmem() - os.freemem();
    const memPercent = (memInfo / os.totalmem()) * 100;
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const cpuPercent = (loadAvg[0] / cpus.length) * 100;

    return {
      status: 'ONLINE',
      xrayRunning: this.xray.isRunning(),
      singboxRunning: this.singbox.isRunning(),
      naiveRunning: this.naive.isRunning(),
      mieruRunning: this.mieru.isRunning(),
      xrayPid: this.xray.getPid(),
      singboxPid: this.singbox.getPid(),
      naivePid: this.naive.getPid(),
      mieruPid: this.mieru.getPid(),
      uptime,
      version: '2.0.0',
      cpuUsage: Math.round(cpuPercent * 100) / 100,
      memUsage: Math.round(memPercent * 100) / 100,
      connections: this.getConnectionCount(),
    };
  }

  getTrafficStats(): Record<string, { upload: number; download: number }> {
    return this.xray.getTrafficStats();
  }

  getCoreStatuses(): Array<{ name: string; running: boolean; pid: number | null; uptime: number | null; restartCount: number; lastError: string | null }> {
    return Array.from(this.cores.entries()).map(([name, state]) => ({
      name,
      running: state.running,
      pid: state.pid,
      uptime: state.startedAt ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000) : null,
      restartCount: state.restartCount,
      lastError: state.lastError,
    }));
  }

  getLogs(coreName: string, count: number = 100): Array<{ time: Date; stream: string; line: string }> {
    const buffer = this.logBuffers.get(coreName);
    return buffer ? buffer.getLast(count) : [];
  }

  getAlerts(count: number = 50): CoreAlert[] {
    return this.alerts.getLast(count);
  }

  clearAlerts(): void {
    this.alerts.clear();
  }

  // ══════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════

  private getConnectionCount(): number {
    try {
      const { execSync } = require('child_process');
      const output = execSync('ss -t state established | wc -l', { encoding: 'utf-8', timeout: 3000 });
      return Math.max(0, (parseInt(output.trim()) || 1) - 1);
    } catch {
      return 0;
    }
  }
}
