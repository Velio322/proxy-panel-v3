import { ChildProcess, spawn } from 'child_process';
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

  generateConfig(inbound: InboundConfig): any {
    const settings = inbound.settings;

    return {
      listen: inbound.listen || '::',
      'listen-port': inbound.port,
      proxy: settings.proxy || 'https://proxy.example.com',
      'cert-dir': settings.certDir || '/etc/ssl/certs',
      'in-nonce': settings.nonce || '',
      'in-proto': settings.proto || 'quic',
      'out-nonce': '',
      'out-proto': settings.proto || 'quic',
      ciphers: settings.ciphers || '',
      'handshake-timeout': settings.handshakeTimeout || 10,
      'idle-timeout': settings.idleTimeout || 30,
    };
  }

  writeConfig(inboundId: string, config: any): string {
    const configPath = path.join(this.configDir, `naive-${inboundId}.json`);
    fs.mkdirSync(this.configDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return configPath;
  }

  start(inbound: InboundConfig): boolean {
    const key = inbound.id;

    // Stop existing process for this inbound
    this.stopOne(key);

    if (!fs.existsSync(this.binPath)) {
      console.error(`[Naive] Binary not found: ${this.binPath}`);
      return false;
    }

    const config = this.generateConfig(inbound);
    const configPath = this.writeConfig(inbound.id, config);

    try {
      const proc = spawn(this.binPath, ['-config', configPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
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
}
