import { EventEmitter } from 'events';
import os from 'os';
import { execSync } from 'child_process';
import { XrayManager } from './core/xray';
import { SingboxManager } from './core/singbox';
import { NaiveManager } from './core/naive';
import { MieruManager } from './core/mieru';
import { ConfigHydrator } from './config-hydrator';
import { PortSharingEngine } from './port-sharing/engine';
import { AuthManager } from './auth-manager';
import { InboundConfig, NodeStatus, RoutingRule } from './types';

interface NodeControllerConfig {
  configDir: string;
  xrayBin: string;
  singboxBin: string;
  naiveBin: string;
  mieruBin: string;
  nodeSecret: string;
  masterUrl: string;
  pollInterval: number;
  haproxyEnabled: boolean;
  haproxyPath: string;
  gracePeriodMs: number;
}

export class NodeController extends EventEmitter {
  private xray: XrayManager;
  private singbox: SingboxManager;
  private naive: NaiveManager;
  private mieru: MieruManager;
  private hydrator: ConfigHydrator;
  private portSharing: PortSharingEngine;
  private auth: AuthManager;
  private config: NodeControllerConfig;
  private startTime: number = Date.now();
  private currentInbounds: InboundConfig[] = [];
  private currentRouting: RoutingRule[] = [];
  private queuePromise: Promise<void> = Promise.resolve();

  constructor(config: NodeControllerConfig) {
    super();
    this.config = config;
    this.xray = new XrayManager(config.configDir, config.xrayBin);
    this.singbox = new SingboxManager(config.configDir, config.singboxBin);
    this.naive = new NaiveManager(config.configDir, config.naiveBin);
    this.mieru = new MieruManager(config.configDir, config.mieruBin);
    this.hydrator = new ConfigHydrator(config.configDir);
    this.portSharing = new PortSharingEngine(config.configDir, config.haproxyEnabled, config.haproxyPath);
    this.auth = new AuthManager(config.nodeSecret);
  }

  async applyConfig(inbounds: InboundConfig[], routing?: RoutingRule[]): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.queuePromise = this.queuePromise
        .then(async () => {
          await this._doRestart(inbounds, routing);
          resolve(true);
        })
        .catch((error: any) => {
          console.error(`[Controller] Config apply failed: ${error.message}`);
          this.emit('error', error);
          resolve(false);
        });
    });
  }

  private async _doRestart(inbounds: InboundConfig[], routing?: RoutingRule[]): Promise<void> {
    const prevInbounds = [...this.currentInbounds];
    this.currentInbounds = inbounds;
    if (routing) this.currentRouting = routing;

    try {
      const portGroups = this.portSharing.analyze(inbounds);
      const remapped = this.portSharing.remapPorts(inbounds);

      const xrayInbounds = remapped.filter((i) =>
        ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(i.protocol) && i.enable
      );
      const singboxInbounds = remapped.filter((i) =>
        ['HYSTERIA2', 'TUIC'].includes(i.protocol) && i.enable
      );
      const naiveInbounds = remapped.filter((i) =>
        i.protocol === 'NAIVEPROXY' && i.enable
      );
      const mieruInbounds = remapped.filter((i) =>
        i.protocol === 'MIERU' && i.enable
      );

      if (xrayInbounds.length > 0) {
        const xrayConfig = this.hydrator.generateXrayConfig(xrayInbounds, this.currentRouting);
        this.xray.writeConfig(xrayConfig);
      }

      if (singboxInbounds.length > 0) {
        const singboxConfig = this.hydrator.generateSingboxConfig(singboxInbounds);
        this.singbox.writeConfig(singboxConfig);
      }

      if (portGroups.size > 0) {
        const haproxyConfig = this.portSharing.generateHAProxyConfig(portGroups);
        this.portSharing.writeHAProxyConfig(haproxyConfig);
      }

      await this.gracefulRestart(xrayInbounds, singboxInbounds, naiveInbounds, mieruInbounds);
      this.emit('configApplied', { xray: xrayInbounds.length, singbox: singboxInbounds.length });
    } catch (error: any) {
      console.error(`[Controller] Config hydration failed: ${error.message}`);
      if (prevInbounds.length > 0) {
        try {
          await this._applyToCores(prevInbounds);
        } catch {
          console.error('[Controller] Rollback failed');
        }
      }
      throw error;
    }
  }

  private async gracefulRestart(
    xrayInbounds: InboundConfig[],
    singboxInbounds: InboundConfig[],
    naiveInbounds: InboundConfig[],
    mieruInbounds: InboundConfig[]
  ): Promise<void> {
    const graceMs = this.config.gracePeriodMs;

    if (xrayInbounds.length > 0) {
      if (this.xray.isRunning()) {
        const reloaded = this.xray.reload();
        if (!reloaded) {
          this.xray.stop();
          await sleep(500);
          this.xray.start();
        }
      } else {
        this.xray.start();
      }
    } else if (this.xray.isRunning()) {
      this.xray.stop();
    }

    if (this.singbox.isRunning() && singboxInbounds.length === 0) {
      this.singbox.stop();
    } else if (singboxInbounds.length > 0) {
      if (this.singbox.isRunning()) {
        this.singbox.stop();
        await sleep(graceMs);
      }
      this.singbox.start();
    }

    if (naiveInbounds.length > 0) {
      this.naive.stopAll();
      await sleep(Math.min(graceMs, 1000));
      for (const inb of naiveInbounds) {
        this.naive.start(inb);
      }
    } else {
      this.naive.stopAll();
    }

    if (mieruInbounds.length > 0) {
      this.mieru.stopAll();
      await sleep(Math.min(graceMs, 1000));
      for (const inb of mieruInbounds) {
        this.mieru.start(inb);
      }
    } else {
      this.mieru.stopAll();
    }

    if (this.config.haproxyEnabled) {
      this.portSharing.reloadHAProxy();
    }
  }

  private async _applyToCores(inbounds: InboundConfig[]): Promise<void> {
    const xrayInbounds = inbounds.filter((i) => ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(i.protocol) && i.enable);
    const singboxInbounds = inbounds.filter((i) => ['HYSTERIA2', 'TUIC'].includes(i.protocol) && i.enable);
    const naiveInbounds = inbounds.filter((i) => i.protocol === 'NAIVEPROXY' && i.enable);
    const mieruInbounds = inbounds.filter((i) => i.protocol === 'MIERU' && i.enable);

    if (xrayInbounds.length > 0) {
      const cfg = this.hydrator.generateXrayConfig(xrayInbounds, this.currentRouting);
      this.xray.writeConfig(cfg);
      this.xray.stop();
      this.xray.start();
    }

    if (singboxInbounds.length > 0) {
      const cfg = this.hydrator.generateSingboxConfig(singboxInbounds);
      this.singbox.writeConfig(cfg);
      this.singbox.stop();
      this.singbox.start();
    }

    for (const inb of naiveInbounds) this.naive.start(inb);
    for (const inb of mieruInbounds) this.mieru.start(inb);
  }

  stopAll(): void {
    this.xray.stop();
    this.singbox.stop();
    this.naive.stopAll();
    this.mieru.stopAll();
    if (this.config.haproxyEnabled) {
      this.portSharing.stopHAProxy();
    }
  }

  getStatus(): NodeStatus {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const memPercent = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    const loadAvg = os.loadavg();
    const cpuPercent = (loadAvg[0] / os.cpus().length) * 100;

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
      version: '3.0.0',
      cpuUsage: Math.round(cpuPercent * 100) / 100,
      memUsage: Math.round(memPercent * 100) / 100,
      connections: this.getConnectionCount(),
    };
  }

  getTrafficStats(): Record<string, { upload: number; download: number }> {
    return this.xray.getTrafficStats();
  }

  private getConnectionCount(): number {
    try {
      const output = execSync('ss -t state established 2>/dev/null | wc -l', { encoding: 'utf-8', timeout: 3000 });
      return Math.max(0, parseInt(output.trim()) - 1);
    } catch {
      return 0;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
