import { ChildProcess, spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { InboundConfig, CoreProcess } from '../types';

export class XrayManager {
  private process: CoreProcess;
  private configDir: string;
  private binPath: string;

  constructor(configDir: string, binPath: string) {
    this.configDir = configDir;
    this.binPath = binPath;
    this.process = {
      name: 'xray',
      process: null,
      pid: null,
      running: false,
      startedAt: null,
      configPath: path.join(configDir, 'xray.json'),
    };
  }

  isRunning(): boolean {
    return this.process.running && this.process.pid !== null;
  }

  getPid(): number | null {
    return this.process.pid;
  }

  generateConfig(inbounds: InboundConfig[]): any {
    const xrayInbounds = inbounds
      .filter((i) => ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(i.protocol))
      .map((inbound) => this.buildInbound(inbound));

    const routingRules: any[] = [
      { type: 'field', ip: ['geoip:private'], outboundTag: 'block' },
    ];

    // Aggregate routing from all inbounds
    for (const inbound of inbounds) {
      const routing = inbound.routing || {};
      if (routing.blockTorrent) {
        routingRules.push({ type: 'field', protocol: ['bittorrent'], outboundTag: 'block' });
      }
      if (routing.blockAds) {
        routingRules.push({ type: 'field', domain: ['geosite:category-ads-all'], outboundTag: 'block' });
      }
      if (routing.customRules && Array.isArray(routing.customRules)) {
        routingRules.push(...routing.customRules);
      }
    }

    return {
      log: { loglevel: 'warning', access: 'none', error: '/var/log/xray/error.log' },
      stats: {},
      api: { services: ['StatsService'], tag: 'api' },
      inbounds: [
        ...xrayInbounds,
        // API inbound for stats
        {
          tag: 'api',
          listen: '127.0.0.1',
          port: 10085,
          protocol: 'dokodemo-door',
          settings: { address: '127.0.0.1' },
        },
      ],
      outbounds: [
        { protocol: 'freedom', tag: 'direct' },
        { protocol: 'blackhole', tag: 'block' },
      ],
      routing: {
        rules: [
          { inboundTag: ['api'], outboundTag: 'api', type: 'field' },
          ...routingRules,
        ],
      },
    };
  }

  private buildInbound(inbound: InboundConfig): any {
    const settings = inbound.settings;
    const stream = inbound.stream || {};

    const base: any = {
      tag: inbound.tag,
      port: inbound.port,
      listen: inbound.listen || '0.0.0.0',
      protocol: inbound.protocol.toLowerCase(),
      settings: {},
      streamSettings: {},
      sniffing: {
        enabled: inbound.sniffing !== false,
        destOverride: ['http', 'tls'],
        routeOnly: true,
      },
    };

    // Protocol-specific settings
    switch (inbound.protocol) {
      case 'VLESS':
        base.settings = {
          users: [{
            id: settings.id || crypto.randomUUID(),
            flow: settings.flow || 'xtls-rprx-vision',
            email: settings.email || '',
            level: 0,
          }],
          decryption: 'none',
        };
        break;

      case 'VMESS':
        base.settings = {
          users: [{
            id: settings.id || crypto.randomUUID(),
            alterId: settings.alterId || 0,
            email: settings.email || '',
            level: 0,
          }],
        };
        break;

      case 'TROJAN':
        base.settings = {
          password: settings.password || crypto.randomBytes(16).toString('hex'),
          clients: [{
            password: settings.password || crypto.randomBytes(16).toString('hex'),
            email: settings.email || '',
            level: 0,
          }],
        };
        break;

      case 'SHADOWSOCKS':
        base.settings = {
          method: settings.method || 'aes-256-gcm',
          password: settings.password || crypto.randomBytes(16).toString('hex'),
          network: settings.network || 'tcp,udp',
        };
        break;
    }

    // Stream settings (transport + security)
    const network = stream.network || 'tcp';
    base.streamSettings = { network };

    // Security
    if (stream.security === 'tls') {
      base.streamSettings.security = 'tls';
      base.streamSettings.tlsSettings = {
        serverName: stream.sni || '',
        fingerprint: stream.fingerprint || 'chrome',
        alpn: stream.alpn ? stream.alpn.split(',') : ['h2', 'http/1.1'],
        allowInsecure: stream.allowInsecure || false,
        minVersion: '1.2',
        maxVersion: '1.3',
        rejectUnknownSni: true,
      };
    }

    if (stream.security === 'reality') {
      base.streamSettings.security = 'reality';
      base.streamSettings.realitySettings = {
        serverName: stream.sni || '',
        fingerprint: stream.fingerprint || 'chrome',
        publicKey: stream.publicKey || '',
        shortId: stream.shortId || '',
        spiderX: stream.spiderX || '',
        dest: stream.dest || 'www.google.com:443',
        serverNames: stream.serverNames || [stream.sni || ''],
      };
    }

    // Transport
    switch (network) {
      case 'ws':
        base.streamSettings.wsSettings = {
          path: stream.wsSettings?.path || '/',
          headers: stream.wsSettings?.headers || {},
        };
        break;

      case 'grpc':
        base.streamSettings.grpcSettings = {
          serviceName: stream.grpcSettings?.serviceName || '',
          multiMode: stream.grpcSettings?.multiMode || false,
        };
        break;

      case 'httpupgrade':
        base.streamSettings.httpupgradeSettings = {
          path: stream.httpupgradeSettings?.path || '/',
          host: stream.httpupgradeSettings?.host || '',
          acceptProxyProtocol: stream.httpupgradeSettings?.acceptProxyProtocol || false,
        };
        break;

      case 'xhttp':
        base.streamSettings.xhttpSettings = {
          path: stream.xhttpSettings?.path || '',
          mode: stream.xhttpSettings?.mode || 'auto',
          extra: stream.xhttpSettings?.extra || {},
        };
        break;

      case 'h2':
        base.streamSettings.httpSettings = {
          path: stream.httpSettings?.path || '/',
          host: stream.httpSettings?.host ? stream.httpSettings.host.split(',') : [''],
          passThroughUri: stream.httpSettings?.passThroughUri || false,
        };
        break;

      case 'kcp':
        base.streamSettings.kcpSettings = {
          header: { type: stream.kcpSettings?.headerType || 'none' },
          seed: stream.kcpSettings?.seed || '',
        };
        break;
    }

    return base;
  }

  writeConfig(config: any): void {
    fs.mkdirSync(this.configDir, { recursive: true });
    fs.writeFileSync(this.process.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  start(): boolean {
    if (this.process.running) {
      this.stop();
    }

    if (!fs.existsSync(this.binPath)) {
      console.error(`[Xray] Binary not found: ${this.binPath}`);
      return false;
    }

    if (!fs.existsSync(this.process.configPath)) {
      console.error(`[Xray] Config not found: ${this.process.configPath}`);
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
        if (line) console.log(`[Xray] ${line}`);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) console.error(`[Xray] ${line}`);
      });

      proc.on('exit', (code, signal) => {
        console.log(`[Xray] Exited (code=${code}, signal=${signal})`);
        this.process.running = false;
        this.process.pid = null;
      });

      proc.on('error', (err) => {
        console.error(`[Xray] Spawn error: ${err.message}`);
        this.process.running = false;
        this.process.pid = null;
      });

      console.log(`[Xray] Started (PID: ${proc.pid})`);
      return true;
    } catch (error: any) {
      console.error(`[Xray] Failed to start: ${error.message}`);
      return false;
    }
  }

  stop(): void {
    if (this.process.process) {
      try {
        this.process.process.kill('SIGTERM');
      } catch {}
      this.process.process = null;
      this.process.pid = null;
      this.process.running = false;
      console.log('[Xray] Stopped');
    }
  }

  restart(): boolean {
    this.stop();
    return this.start();
  }

  reload(): boolean {
    // Xray supports graceful reload via SIGHUP
    if (this.process.process && this.process.pid) {
      try {
        this.process.process.kill('SIGHUP');
        console.log('[Xray] Reloaded (SIGHUP)');
        return true;
      } catch {}
    }
    return this.restart();
  }

  getTrafficStats(): Record<string, { upload: number; download: number }> {
    try {
      const output = execSync(
        `${this.binPath} api statsquery --server=127.0.0.1:10085 2>/dev/null`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      const parsed = JSON.parse(output);
      const stats: Record<string, { upload: number; download: number }> = {};

      if (parsed.stat) {
        const statList = Array.isArray(parsed.stat) ? parsed.stat : [parsed.stat];
        for (const stat of statList) {
          const name = stat.name || '';
          const value = parseInt(stat.value || '0');
          // Name format: "user>>>email>>>traffic>>>uplink/downlink"
          const parts = name.split('>>>');
          const direction = parts[parts.length - 1];
          const email = parts[1] || 'unknown';

          if (!stats[email]) stats[email] = { upload: 0, download: 0 };
          if (direction === 'uplink') stats[email].upload += value;
          if (direction === 'downlink') stats[email].download += value;
        }
      }

      return stats;
    } catch {
      return {};
    }
  }
}
