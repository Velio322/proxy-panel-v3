import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { InboundConfig, CoreProcess } from '../types';

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

  generateConfig(inbound: InboundConfig): any {
    const settings = inbound.settings;

    return {
      port: inbound.port,
      portRange: settings.portRange || [],
      socks5: { port: 0 },
      http: { port: 0 },
      users: [{
        name: settings.username || 'user',
        password: settings.password || crypto.randomBytes(16).toString('hex'),
      }],
      authentication: settings.authentication || 'password',
      bindAddress: inbound.listen || '0.0.0.0',
      loggingLevel: settings.loggingLevel || 'warn',
    };
  }

  writeConfig(inboundId: string, config: any): string {
    const configPath = path.join(this.configDir, `mieru-${inboundId}.json`);
    fs.mkdirSync(this.configDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return configPath;
  }

  start(inbound: InboundConfig): boolean {
    const key = inbound.id;

    this.stopOne(key);

    if (!fs.existsSync(this.binPath)) {
      console.error(`[Mieru] Binary not found: ${this.binPath}`);
      return false;
    }

    const config = this.generateConfig(inbound);
    const configPath = this.writeConfig(inbound.id, config);

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
}
