import { ChildProcess, spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { InboundConfig, CoreProcess } from '../types';

// ══════════════════════════════════════════════
// NaiveProxy Manager (Caddy-based)
// ══════════════════════════════════════════════
// NaiveProxy is a Caddy plugin (forward_proxy).
// All reference panels (RIXXX, Veil, Iceslab) use Caddy
// with forward_proxy directives. This manager generates
// proper Caddyfiles, not standalone JSON configs.
// ══════════════════════════════════════════════

export class NaiveManager {
  private processes: Map<string, CoreProcess> = new Map();
  private configDir: string;
  private binPath: string; // Path to Caddy binary with naive plugin

  constructor(configDir: string, binPath: string) {
    this.configDir = configDir;
    this.binPath = binPath;
  }

  isRunning(): boolean {
    for (const proc of this.processes.values()) {
      if (proc.running) return true;
    }
    return false;
  }

  getPid(): number | null {
    for (const proc of this.processes.values()) {
      if (proc.pid) return proc.pid;
    }
    return null;
  }

  getRunningCount(): number {
    let count = 0;
    for (const proc of this.processes.values()) {
      if (proc.running) count++;
    }
    return count;
  }

  // ══════════════════════════════════════════════
  // Caddyfile Generation
  // ══════════════════════════════════════════════

  generateCaddyfile(inbound: InboundConfig): string {
    const settings = inbound.settings;
    const domain = settings.domain || settings.sni || 'example.com';
    const email = settings.email || `admin@${domain}`;
    const port = inbound.port || 443;
    const listen = inbound.listen || '0.0.0.0';

    // Users: support both single-user and multi-user
    const users: Array<{ username: string; password: string }> = [];
    if (settings.users && Array.isArray(settings.users)) {
      for (const u of settings.users) {
        users.push({
          username: u.username || u.name || 'user',
          password: u.password || crypto.randomBytes(16).toString('hex'),
        });
      }
    } else if (settings.username) {
      users.push({
        username: settings.username,
        password: settings.password || crypto.randomBytes(16).toString('hex'),
      });
    } else {
      // Default user
      users.push({
        username: 'user',
        password: settings.password || crypto.randomBytes(16).toString('hex'),
      });
    }

    // Forward proxy directives (hardcoded best practices from RIXXX/Veil)
    const hideIp = settings.hideIp !== false;      // default: true
    const hideVia = settings.hideVia !== false;      // default: true
    const probeResistance = settings.probeResistance !== false; // default: true

    // Fallback/camouflage
    const fallbackRoot = settings.fallbackRoot || '/var/www/html';

    // WARP upstream (Veil feature)
    const warpUpstream = settings.warpUpstream || '';

    // TLS mode
    const tlsMode = settings.tlsMode || 'letsencrypt'; // 'letsencrypt' | 'custom' | 'acme'
    const certFile = settings.certFile || '';
    const keyFile = settings.keyFile || '';

    // Build Caddyfile
    let caddyfile = '';
    caddyfile += `{\n`;
    caddyfile += `  order forward_proxy before file_server\n`;
    caddyfile += `  servers {\n`;
    caddyfile += `    protocols h1 h2\n`;
    caddyfile += `  }\n`;
    caddyfile += `}\n\n`;

    // Listen block
    caddyfile += `:${port}, ${domain} {\n`;

    // TLS configuration
    if (tlsMode === 'custom' && certFile && keyFile) {
      caddyfile += `  tls ${certFile} ${keyFile}\n`;
    } else {
      caddyfile += `  tls ${email}\n`;
    }

    caddyfile += `\n`;

    // Forward proxy block
    caddyfile += `  forward_proxy {\n`;

    // Users (multiple basic_auth lines)
    for (const user of users) {
      caddyfile += `    basic_auth ${user.username} ${user.password}\n`;
    }

    if (hideIp) caddyfile += `    hide_ip\n`;
    if (hideVia) caddyfile += `    hide_via\n`;
    if (probeResistance) caddyfile += `    probe_resistance\n`;

    // WARP upstream (Veil feature — route through Cloudflare WARP)
    if (warpUpstream) {
      caddyfile += `    upstream ${warpUpstream}\n`;
    }

    caddyfile += `  }\n\n`;

    // Fallback / camouflage file server
    caddyfile += `  root * ${fallbackRoot}\n`;
    caddyfile += `  file_server\n`;

    caddyfile += `}\n`;

    return caddyfile;
  }

  // ══════════════════════════════════════════════
  // Config Write
  // ══════════════════════════════════════════════

  writeCaddyfile(inboundId: string, caddyfile: string): string {
    const configPath = path.join(this.configDir, `naive-${inboundId}.Caddyfile`);
    fs.mkdirSync(this.configDir, { recursive: true });
    fs.writeFileSync(configPath, caddyfile, 'utf-8');
    return configPath;
  }

  // ══════════════════════════════════════════════
  // Validation (Veil feature — validate before apply)
  // ══════════════════════════════════════════════

  validate(configPath: string): { valid: boolean; error?: string } {
    try {
      execSync(`${this.binPath} validate --config ${configPath}`, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err.stderr || err.message };
    }
  }

  // ══════════════════════════════════════════════
  // Process Lifecycle
  // ══════════════════════════════════════════════

  start(inbound: InboundConfig): boolean {
    const key = inbound.id;
    this.stopOne(key);

    if (!fs.existsSync(this.binPath)) {
      console.error(`[Naive] Caddy binary not found: ${this.binPath}`);
      return false;
    }

    // Generate Caddyfile
    const caddyfile = this.generateCaddyfile(inbound);
    const configPath = this.writeCaddyfile(inbound.id, caddyfile);

    console.log(`[Naive:${inbound.tag}] Generated Caddyfile at ${configPath}`);

    // Validate before start
    const validation = this.validate(configPath);
    if (!validation.valid) {
      console.error(`[Naive:${inbound.tag}] Caddyfile validation failed: ${validation.error}`);
      return false;
    }

    // Ensure fallback directory exists
    const settings = inbound.settings;
    const fallbackRoot = settings.fallbackRoot || '/var/www/html';
    try { fs.mkdirSync(fallbackRoot, { recursive: true }); } catch {}

    // Create a minimal index.html if it doesn't exist
    const indexFile = path.join(fallbackRoot, 'index.html');
    if (!fs.existsSync(indexFile)) {
      fs.writeFileSync(indexFile, '<!DOCTYPE html><html><head><title>Welcome</title></head><body><h1>Welcome</h1></body></html>');
    }

    try {
      const proc = spawn(this.binPath, ['run', '--config', configPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      const coreProcess: CoreProcess = {
        name: `naive-${inbound.tag}`,
        process: proc,
        pid: proc.pid || null,
        running: true,
        startedAt: new Date(),
        configPath,
      };

      this.processes.set(key, coreProcess);

      proc.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) console.log(`[Naive:${inbound.tag}] ${line}`);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) console.error(`[Naive:${inbound.tag}] ${line}`);
      });

      proc.on('exit', (code) => {
        console.log(`[Naive:${inbound.tag}] Exited (code=${code})`);
        coreProcess.running = false;
        coreProcess.pid = null;
      });

      proc.on('error', (err) => {
        console.error(`[Naive:${inbound.tag}] Error: ${err.message}`);
        coreProcess.running = false;
        coreProcess.pid = null;
      });

      console.log(`[Naive:${inbound.tag}] Started (PID: ${proc.pid})`);
      return true;
    } catch (error: any) {
      console.error(`[Naive:${inbound.tag}] Failed: ${error.message}`);
      return false;
    }
  }

  stopOne(key: string): void {
    const proc = this.processes.get(key);
    if (proc?.process) {
      try { proc.process.kill('SIGTERM'); } catch {}
      proc.process = null;
      proc.pid = null;
      proc.running = false;
      console.log(`[Naive:${proc.name}] Stopped`);
    }
  }

  stopAll(): void {
    for (const [key] of this.processes) {
      this.stopOne(key);
    }
    this.processes.clear();
  }

  restart(inbound: InboundConfig): boolean {
    this.stopOne(inbound.id);
    return this.start(inbound);
  }

  // ══════════════════════════════════════════════
  // Subscription Link Generation
  // ══════════════════════════════════════════════

  generateSubLink(inbound: InboundConfig, user: { username: string; password: string }): string {
    const settings = inbound.settings;
    const domain = settings.domain || settings.sni || 'example.com';
    const port = inbound.port || 443;
    return `naive+https://${user.username}:${user.password}@${domain}:${port}`;
  }
}
