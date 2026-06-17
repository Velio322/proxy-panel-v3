import { ChildProcess, spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { InboundConfig, CoreProcess } from '../types';

// ══════════════════════════════════════════════
// Mieru Manager
// ══════════════════════════════════════════════
// Based on Veil and Iceslab reference implementations.
// Mieru uses JSON config with portBindings for dual
// TCP/UDP transport on the same port.
// ══════════════════════════════════════════════

export class MieruManager {
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

  // ══════════════════════════════════════════════
  // Config Generation (Veil/Iceslab parity)
  // ══════════════════════════════════════════════

  generateConfig(inbound: InboundConfig): any {
    const settings = inbound.settings;
    const port = inbound.port || 443;

    // Transport: TCP, UDP, or both (Veil feature — dual binding)
    const transport = (settings.transport || 'tcp').toLowerCase();
    const portBindings: Array<{ port: number; protocol: string }> = [];

    if (transport === 'both' || transport === 'tcp' || transport === 'tcp,udp') {
      portBindings.push({ port, protocol: 'TCP' });
    }
    if (transport === 'both' || transport === 'udp' || transport === 'tcp,udp') {
      portBindings.push({ port, protocol: 'UDP' });
    }

    // If no binding specified, default to TCP
    if (portBindings.length === 0) {
      portBindings.push({ port, protocol: 'TCP' });
    }

    // Users: support multi-user (Veil/Iceslab feature)
    const users: Array<{ name: string; password: string }> = [];
    if (settings.users && Array.isArray(settings.users)) {
      for (const u of settings.users) {
        users.push({
          name: u.username || u.name || 'user',
          password: u.password || crypto.randomBytes(16).toString('hex'),
        });
      }
    } else if (settings.username) {
      users.push({
        name: settings.username,
        password: settings.password || crypto.randomBytes(16).toString('hex'),
      });
    } else {
      users.push({
        name: 'user',
        password: settings.password || crypto.randomBytes(16).toString('hex'),
      });
    }

    // Logging level
    const loggingLevel = settings.loggingLevel || 'INFO';

    return {
      portBindings,
      users,
      loggingLevel,
    };
  }

  // ══════════════════════════════════════════════
  // Client Config Generation (Veil parity)
  // ══════════════════════════════════════════════

  generateClientConfig(inbound: InboundConfig, user: { name: string; password: string }): any {
    const settings = inbound.settings;
    const domain = settings.domain || settings.sni || 'example.com';
    const port = inbound.port || 443;
    const transport = (settings.transport || 'tcp').toLowerCase();

    const portBindings: Array<{ port: number; protocol: string }> = [];
    if (transport === 'both' || transport === 'tcp' || transport === 'tcp,udp') {
      portBindings.push({ port, protocol: 'TCP' });
    }
    if (transport === 'both' || transport === 'udp' || transport === 'tcp,udp') {
      portBindings.push({ port, protocol: 'UDP' });
    }
    if (portBindings.length === 0) {
      portBindings.push({ port, protocol: 'TCP' });
    }

    return {
      profileName: inbound.tag,
      user: { name: user.name, password: user.password },
      servers: [
        {
          domainName: domain,
          portBindings,
        },
      ],
    };
  }

  // ══════════════════════════════════════════════
  // Config Write
  // ══════════════════════════════════════════════

  writeConfig(inboundId: string, config: any): string {
    const configPath = path.join(this.configDir, `mieru-${inboundId}.json`);
    fs.mkdirSync(this.configDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return configPath;
  }

  // ══════════════════════════════════════════════
  // Validation (Veil feature — mieru check before apply)
  // ══════════════════════════════════════════════

  validate(configPath: string): { valid: boolean; error?: string } {
    try {
      execSync(`${this.binPath} check -c ${configPath}`, {
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
      console.error(`[Mieru] Binary not found: ${this.binPath}`);
      return false;
    }

    const config = this.generateConfig(inbound);
    const configPath = this.writeConfig(inbound.id, config);

    console.log(`[Mieru:${inbound.tag}] Config: ${config.portBindings.length} bindings, ${config.users.length} users`);

    // Validate before start
    const validation = this.validate(configPath);
    if (!validation.valid) {
      console.error(`[Mieru:${inbound.tag}] Config validation failed: ${validation.error}`);
      return false;
    }

    try {
      const proc = spawn(this.binPath, ['run'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, MIERU_CONF_FILE: configPath },
      });

      const coreProcess: CoreProcess = {
        name: `mieru-${inbound.tag}`,
        process: proc,
        pid: proc.pid || null,
        running: true,
        startedAt: new Date(),
        configPath,
      };

      this.processes.set(key, coreProcess);

      proc.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) console.log(`[Mieru:${inbound.tag}] ${line}`);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) console.error(`[Mieru:${inbound.tag}] ${line}`);
      });

      proc.on('exit', (code) => {
        console.log(`[Mieru:${inbound.tag}] Exited (code=${code})`);
        coreProcess.running = false;
        coreProcess.pid = null;
      });

      proc.on('error', (err) => {
        console.error(`[Mieru:${inbound.tag}] Error: ${err.message}`);
        coreProcess.running = false;
        coreProcess.pid = null;
      });

      console.log(`[Mieru:${inbound.tag}] Started (PID: ${proc.pid})`);
      return true;
    } catch (error: any) {
      console.error(`[Mieru:${inbound.tag}] Failed: ${error.message}`);
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
      console.log(`[Mieru:${proc.name}] Stopped`);
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

  generateSubLink(inbound: InboundConfig, user: { name: string; password: string }): string {
    const settings = inbound.settings;
    const domain = settings.domain || settings.sni || 'example.com';
    const port = inbound.port || 443;
    return `mieru://${user.name}:${user.password}@${domain}:${port}`;
  }
}
