import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { InboundConfig, CoreProcess } from '../types';

export class NaiveManager {
  private processes: Map<string, CoreProcess> = new Map();
  private configDir: string;
  private binPath: string;

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

  generateCaddyfile(inbound: InboundConfig): string {
    const settings = inbound.settings;
    const domain = settings.domain || settings.sni || 'example.com';
    const email = settings.email || `admin@${domain}`;
    const port = inbound.port || 443;

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
      users.push({
        username: 'user',
        password: settings.password || crypto.randomBytes(16).toString('hex'),
      });
    }

    const hideIp = settings.hideIp !== false;
    const hideVia = settings.hideVia !== false;
    const probeResistance = settings.probeResistance !== false;
    const fallbackRoot = settings.fallbackRoot || '/var/www/html';
    const warpUpstream = settings.warpUpstream || '';
    const tlsMode = settings.tlsMode || 'letsencrypt';
    const certFile = settings.certFile || '';
    const keyFile = settings.keyFile || '';

    let caddyfile = '';
    caddyfile += `{\n`;
    caddyfile += `  order forward_proxy before file_server\n`;
    caddyfile += `  servers {\n`;
    caddyfile += `    protocols h1 h2\n`;
    caddyfile += `  }\n`;
    caddyfile += `}\n\n`;

    caddyfile += `:${port}, ${domain} {\n`;

    if (tlsMode === 'custom' && certFile && keyFile) {
      caddyfile += `  tls ${certFile} ${keyFile}\n`;
    } else {
      caddyfile += `  tls ${email}\n`;
    }

    caddyfile += `\n`;
    caddyfile += `  forward_proxy {\n`;

    for (const user of users) {
      caddyfile += `    basic_auth ${user.username} ${user.password}\n`;
    }

    if (hideIp) caddyfile += `    hide_ip\n`;
    if (hideVia) caddyfile += `    hide_via\n`;
    if (probeResistance) caddyfile += `    probe_resistance\n`;

    if (warpUpstream) {
      caddyfile += `    upstream ${warpUpstream}\n`;
    }

    caddyfile += `  }\n\n`;
    caddyfile += `  root * ${fallbackRoot}\n`;
    caddyfile += `  file_server\n`;
    caddyfile += `}\n`;

    return caddyfile;
  }

  writeCaddyfile(inboundId: string, caddyfile: string): string {
    const configPath = path.join(this.configDir, `naive-${inboundId}.Caddyfile`);
    fs.mkdirSync(this.configDir, { recursive: true });
    fs.writeFileSync(configPath, caddyfile, 'utf-8');
    return configPath;
  }

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

  start(inbound: InboundConfig): boolean {
    const key = inbound.id;
    this.stopOne(key);

    if (!fs.existsSync(this.binPath)) {
      console.error(`[Naive] Caddy binary not found: ${this.binPath}`);
      return false;
    }

    const caddyfile = this.generateCaddyfile(inbound);
    const configPath = this.writeCaddyfile(inbound.id, caddyfile);

    const validation = this.validate(configPath);
    if (!validation.valid) {
      console.error(`[Naive:${inbound.tag}] Caddyfile validation failed: ${validation.error}`);
      return false;
    }

    const settings = inbound.settings;
    const fallbackRoot = settings.fallbackRoot || '/var/www/html';
    try { fs.mkdirSync(fallbackRoot, { recursive: true }); } catch {}

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

  generateSubLink(inbound: InboundConfig, user: { username: string; password: string }): string {
    const settings = inbound.settings;
    const domain = settings.domain || settings.sni || 'example.com';
    const port = inbound.port || 443;
    return `naive+https://${user.username}:${user.password}@${domain}:${port}`;
  }
}
