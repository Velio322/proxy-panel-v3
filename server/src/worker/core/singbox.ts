import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { InboundConfig, CoreProcess } from '../types';

export class SingboxManager {
  private process: CoreProcess;
  private configDir: string;
  private binPath: string;

  constructor(configDir: string, binPath: string) {
    this.configDir = configDir;
    this.binPath = binPath;
    this.process = {
      name: 'singbox',
      process: null,
      pid: null,
      running: false,
      startedAt: null,
      configPath: path.join(configDir, 'singbox.json'),
    };
  }

  isRunning(): boolean {
    return this.process.running && this.process.pid !== null;
  }

  getPid(): number | null {
    return this.process.pid;
  }

  generateConfig(inbounds: InboundConfig[]): any {
    // sing-box-extended supports: HYSTERIA2, TUIC, NAIVEPROXY, MIERU
    const singboxInbounds = inbounds
      .filter((i) => ['HYSTERIA2', 'TUIC', 'NAIVEPROXY', 'MIERU'].includes(i.protocol))
      .map((inbound) => this.buildInbound(inbound))
      .filter((i): i is NonNullable<typeof i> => i !== null);

    return {
      log: { level: 'warn', timestamp: true },
      dns: {
        servers: [
          { tag: 'google', address: 'tls://8.8.8.8', detour: 'direct' },
          { tag: 'local', address: 'local', detour: 'direct' },
        ],
        rules: [
          { domain_suffix: ['.ir'], server: 'local' },
          { clash_mode: 'direct', server: 'local' },
        ],
      },
      inbounds: singboxInbounds,
      outbounds: [
        { type: 'direct', tag: 'direct' },
        { type: 'block', tag: 'block' },
      ],
      route: {
        rules: [
          { ip_is_private: true, outbound: 'block' },
        ],
        auto_detect_interface: true,
      },
      experimental: {
        clash_api: {
          external_controller: '127.0.0.1:9090',
          external_ui: '/etc/sing-box/ui',
        },
      },
    };
  }

  private buildInbound(inbound: InboundConfig): any {
    const settings = inbound.settings;

    if (inbound.protocol === 'HYSTERIA2') {
      const user: any = {
        name: settings.username || 'user',
        password: settings.password || crypto.randomBytes(16).toString('hex'),
      };

      const result: any = {
        type: 'hysteria2',
        tag: inbound.tag,
        listen: inbound.listen || '::',
        listen_port: inbound.port,
        users: [user],
        obfs: settings.obfs?.type && settings.obfs.type !== 'none' ? {
          type: settings.obfs.type || 'salamander',
          password: settings.obfs.password || '',
        } : undefined,
        tls: {
          enabled: true,
          server_name: settings.sni || '',
          alpn: ['h3'],
        },
      };

      if (settings.maxUploadSpeed) result.max_upload_speed = settings.maxUploadSpeed;
      if (settings.maxDownloadSpeed) result.max_download_speed = settings.maxDownloadSpeed;

      return result;
    }

    if (inbound.protocol === 'TUIC') {
      return {
        type: 'tuic',
        tag: inbound.tag,
        listen: inbound.listen || '::',
        listen_port: inbound.port,
        users: [{
          name: settings.username || 'user',
          uuid: settings.id || crypto.randomUUID(),
          password: settings.password || crypto.randomBytes(16).toString('hex'),
        }],
        congestion_control: settings.congestion_control || 'bbr',
        zero_rtt_handshake: settings.zero_rtt || false,
        tls: {
          enabled: true,
          server_name: settings.sni || '',
          alpn: ['h3'],
        },
      };
    }

    // ── NaiveProxy — sing-box-extended "naive" inbound ──
    // Requires sing-box compiled with with_naive_outbound tag (extended build)
    if (inbound.protocol === 'NAIVEPROXY') {
      const users: Array<{ username: string; password: string }> = [];

      // Support multi-user via clients array
      if (Array.isArray(settings.clients) && settings.clients.length > 0) {
        for (const c of settings.clients) {
          users.push({
            username: c.username || c.name || 'user',
            password: c.password || crypto.randomBytes(16).toString('hex'),
          });
        }
      } else {
        users.push({
          username: settings.username || settings.user || 'user',
          password: settings.password || crypto.randomBytes(16).toString('hex'),
        });
      }

      const result: any = {
        type: 'naive',
        tag: inbound.tag,
        listen: inbound.listen || '::',
        listen_port: inbound.port,
        users,
        tls: {
          enabled: true,
          server_name: settings.sni || settings.domain || '',
          alpn: ['h3', 'http/1.1'],
        },
      };

      // Optional: ACME auto-cert
      if (settings.domain && settings.email) {
        result.tls.acme = {
          domain: [settings.domain],
          email: settings.email,
          provider: 'letsencrypt',
        };
      } else if (settings.certFile && settings.keyFile) {
        result.tls.certificate_path = settings.certFile;
        result.tls.key_path = settings.keyFile;
      }

      return result;
    }

    // ── Mieru — sing-box-extended "mieru" inbound ──
    // Requires sing-box-extended build (1.x.x-extended-y.z.w)
    // Mieru uses its own protocol over TCP/UDP
    if (inbound.protocol === 'MIERU') {
      const users: Array<{ name: string; password: string }> = [];

      if (Array.isArray(settings.clients) && settings.clients.length > 0) {
        for (const c of settings.clients) {
          users.push({
            name: c.username || c.name || 'user',
            password: c.password || crypto.randomBytes(16).toString('hex'),
          });
        }
      } else {
        users.push({
          name: settings.username || 'user',
          password: settings.password || crypto.randomBytes(16).toString('hex'),
        });
      }

      // Transport: TCP, UDP or both
      const transport = (settings.transport || 'tcp').toLowerCase();
      const portBindings: Array<{ port: number; protocol: string }> = [];
      if (transport === 'tcp' || transport === 'both' || transport === 'tcp,udp') {
        portBindings.push({ port: inbound.port, protocol: 'TCP' });
      }
      if (transport === 'udp' || transport === 'both' || transport === 'tcp,udp') {
        portBindings.push({ port: inbound.port, protocol: 'UDP' });
      }
      if (portBindings.length === 0) {
        portBindings.push({ port: inbound.port, protocol: 'TCP' });
      }

      return {
        type: 'mieru',
        tag: inbound.tag,
        listen: inbound.listen || '::',
        listen_port: inbound.port,
        users,
        transport: portBindings.map(b => b.protocol.toLowerCase()),
      };
    }

    return null;
  }

  writeConfig(config: any): void {
    fs.mkdirSync(this.configDir, { recursive: true });
    fs.writeFileSync(this.process.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  start(): boolean {
    if (this.process.running) this.stop();

    if (!fs.existsSync(this.binPath)) {
      console.error(`[Singbox] Binary not found: ${this.binPath}`);
      return false;
    }

    if (!fs.existsSync(this.process.configPath)) {
      console.error(`[Singbox] Config not found: ${this.process.configPath}`);
      return false;
    }

    try {
      const proc = spawn(this.binPath, ['run', '-c', this.process.configPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      this.process.process = proc;
      this.process.pid = proc.pid || null;
      this.process.running = true;
      this.process.startedAt = new Date();

      proc.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) console.log(`[Singbox] ${line}`);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) console.error(`[Singbox] ${line}`);
      });

      proc.on('exit', (code) => {
        console.log(`[Singbox] Exited (code=${code})`);
        this.process.running = false;
        this.process.pid = null;
      });

      proc.on('error', (err) => {
        console.error(`[Singbox] Spawn error: ${err.message}`);
        this.process.running = false;
        this.process.pid = null;
      });

      console.log(`[Singbox] Started (PID: ${proc.pid})`);
      return true;
    } catch (error: any) {
      console.error(`[Singbox] Failed to start: ${error.message}`);
      return false;
    }
  }

  stop(): void {
    if (this.process.process) {
      try { this.process.process.kill('SIGTERM'); } catch {}
      this.process.process = null;
      this.process.pid = null;
      this.process.running = false;
      console.log('[Singbox] Stopped');
    }
  }

  restart(): boolean {
    this.stop();
    return this.start();
  }
}
