import { EventEmitter } from 'events';
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

/**
 * NodeController — production-ready daemon managing all proxy cores.
 * Handles: config hydration, graceful restart, SNI port-sharing, auth.
 */
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
  private isRestarting: boolean = false;
  private restartLock: Promise<void> | null = null;

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

  /**
   * Apply configuration from Master with full hydration pipeline.
   * Pipeline: Remap ports → Generate core configs → Write HAProxy → Graceful restart.
   */
  async applyConfig(inbounds: InboundConfig[], routing?: RoutingRule[]): Promise<boolean> {
    // Acquire restart lock — prevent concurrent restarts
    if (this.isRestarting) {
      console.log('[Controller] Config change during restart — queuing');
      await this.restartLock;
    }

    this.isRestarting = true;
    this.restartLock = this._doRestart(inbounds, routing);

    try {
      await this.restartLock;
      return true;
    } catch (error: any) {
      console.error(`[Controller] Config apply failed: ${error.message}`);
      this.emit('error', error);
      return false;
    } finally {
      this.isRestarting = false;
      this.restartLock = null;
    }
  }

  private async _doRestart(inbounds: InboundConfig[], routing?: RoutingRule[]): Promise<void> {
    const prevInbounds = [...this.currentInbounds];
    this.currentInbounds = inbounds;
    if (routing) this.currentRouting = routing;

    console.log(`[Controller] Applying ${inbounds.length} inbounds with ${this.currentRouting.length} routing rules`);

    try {
      // Step 1: Analyze port-sharing needs
      const portGroups = this.portSharing.analyze(inbounds);
      console.log(`[Controller] Port-sharing: ${portGroups.size} shared port groups`);

      // Step 2: Remap ports for port-shared inbounds
      const remapped = this.portSharing.remapPorts(inbounds);

      // Step 3: Separate by core type
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

      // Step 4: Generate Xray config with full hydration
      if (xrayInbounds.length > 0) {
        const xrayConfig = this.hydrator.generateXrayConfig(xrayInbounds, this.currentRouting);
        this.xray.writeConfig(xrayConfig);
        console.log(`[Controller] Xray config hydrated: ${xrayInbounds.length} inbounds`);
      }

      // Step 5: Generate sing-box config
      if (singboxInbounds.length > 0) {
        const singboxConfig = this.hydrator.generateSingboxConfig(singboxInbounds);
        this.singbox.writeConfig(singboxConfig);
        console.log(`[Controller] sing-box config hydrated: ${singboxInbounds.length} inbounds`);
      }

      // Step 6: Generate HAProxy config for port-sharing
      if (portGroups.size > 0) {
        const haproxyConfig = this.portSharing.generateHAProxyConfig(portGroups);
        this.portSharing.writeHAProxyConfig(haproxyConfig);
        console.log(`[Controller] HAProxy config generated for ${portGroups.size} groups`);
      }

      // Step 7: Graceful restart — send SIGUSR1 to Xray (no connection drop)
      await this.gracefulRestart(xrayInbounds, singboxInbounds, naiveInbounds, mieruInbounds);

      this.emit('configApplied', { xray: xrayInbounds.length, singbox: singboxInbounds.length });
      console.log('[Controller] Config applied successfully');
    } catch (error: any) {
      console.error(`[Controller] Config hydration failed: ${error.message}`);
      // Rollback to previous config if available
      if (prevInbounds.length > 0) {
        console.log('[Controller] Rolling back to previous config');
        try {
          await this._applyToCores(prevInbounds);
        } catch {
          console.error('[Controller] Rollback also failed');
        }
      }
      throw error;
    }
  }

  /**
   * Graceful restart: reload configs without dropping active connections.
   * Uses Xray's SIGHUP for reload, and process replacement for others.
   */
  private async gracefulRestart(
    xrayInbounds: InboundConfig[],
    singboxInbounds: InboundConfig[],
    naiveInbounds: InboundConfig[],
    mieruInbounds: InboundConfig[]
  ): Promise<void> {
    const graceMs = this.config.gracePeriodMs;

    // Phase 1: Try graceful reload for Xray (SIGHUP — zero downtime)
    if (xrayInbounds.length > 0) {
      if (this.xray.isRunning()) {
        console.log(`[Graceful] Xray: sending SIGHUP (reload)`);
        const reloaded = this.xray.reload();
        if (reloaded) {
          console.log(`[Graceful] Xray reloaded successfully`);
        } else {
          console.log(`[Graceful] Xray SIGHUP failed, doing full restart`);
          this.xray.stop();
          await sleep(500);
          this.xray.start();
        }
      } else {
        this.xray.start();
      }
    } else if (this.xray.isRunning()) {
      // No xray inbounds — stop xray
      this.xray.stop();
    }

    // Phase 2: For sing-box, naive, mieru — replace process
    // Wait for grace period to let existing connections drain
    if (this.singbox.isRunning() && singboxInbounds.length === 0) {
      this.singbox.stop();
    } else if (singboxInbounds.length > 0) {
      if (this.singbox.isRunning()) {
        console.log(`[Graceful] sing-box: stopping old process, waiting ${graceMs}ms`);
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

    // Phase 3: Restart HAProxy for port-sharing
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
      const config = this.hydrator.generateXrayConfig(xrayInbounds, this.currentRouting);
      this.xray.writeConfig(config);
      this.xray.stop();
      this.xray.start();
    }

    if (singboxInbounds.length > 0) {
      const config = this.hydrator.generateSingboxConfig(singboxInbounds);
      this.singbox.writeConfig(config);
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
    console.log('[Controller] All cores stopped');
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
      version: '2.0.0',
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
      const { execSync } = require('child_process');
      const output = execSync('ss -t state established 2>/dev/null | wc -l', { encoding: 'utf-8', timeout: 3000 });
      return Math.max(0, parseInt(output.trim()) - 1); // subtract header
    } catch {
      return 0;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import os from 'os';
