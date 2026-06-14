import os from 'os';
import { XrayManager } from './core/xray';
import { SingboxManager } from './core/singbox';
import { NaiveManager } from './core/naive';
import { MieruManager } from './core/mieru';
import { SNIRouter } from './port-sharing/sni-router';
import { InboundConfig, NodeStatus } from './types';

export class ProcessManager {
  private xray: XrayManager;
  private singbox: SingboxManager;
  private naive: NaiveManager;
  private mieru: MieruManager;
  private sniRouter: SNIRouter;
  private configDir: string;
  private startTime: number = Date.now();
  private currentInbounds: InboundConfig[] = [];

  constructor(config: {
    configDir: string;
    xrayBin: string;
    singboxBin: string;
    naiveBin: string;
    mieruBin: string;
    haproxyEnabled?: boolean;
  }) {
    this.configDir = config.configDir;
    this.xray = new XrayManager(config.configDir, config.xrayBin);
    this.singbox = new SingboxManager(config.configDir, config.singboxBin);
    this.naive = new NaiveManager(config.configDir, config.naiveBin);
    this.mieru = new MieruManager(config.configDir, config.mieruBin);
    this.sniRouter = new SNIRouter(config.configDir, {
      haproxy: config.haproxyEnabled ?? true,
    });
  }

  /**
   * Apply full configuration: generate configs, handle port-sharing, start all cores.
   */
  applyConfig(inbounds: InboundConfig[]): boolean {
    console.log(`[PM] Applying config: ${inbounds.length} inbounds`);
    this.currentInbounds = inbounds;

    try {
      // Stop all existing processes
      this.stopAll();

      // Determine port-sharing remapping
      const remappedInbounds = this.sniRouter.remapInboundPorts(inbounds);

      // Apply SNI routing for port-shared inbounds
      this.sniRouter.applyPortSharing(inbounds);

      // Separate inbounds by core type
      const xrayInbounds = remappedInbounds.filter((i) =>
        ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(i.protocol) && i.enable
      );
      const singboxInbounds = remappedInbounds.filter((i) =>
        ['HYSTERIA2', 'TUIC'].includes(i.protocol) && i.enable
      );
      const naiveInbounds = remappedInbounds.filter((i) =>
        i.protocol === 'NAIVEPROXY' && i.enable
      );
      const mieruInbounds = remappedInbounds.filter((i) =>
        i.protocol === 'MIERU' && i.enable
      );

      // Generate and write configs
      let allSuccess = true;

      if (xrayInbounds.length > 0) {
        const xrayConfig = this.xray.generateConfig(xrayInbounds);
        this.xray.writeConfig(xrayConfig);
        if (!this.xray.start()) allSuccess = false;
      }

      if (singboxInbounds.length > 0) {
        const singboxConfig = this.singbox.generateConfig(singboxInbounds);
        this.singbox.writeConfig(singboxConfig);
        if (!this.singbox.start()) allSuccess = false;
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

  restart(): boolean {
    console.log('[PM] Restarting all cores...');
    return this.applyConfig(this.currentInbounds);
  }

  stopAll(): void {
    console.log('[PM] Stopping all cores...');
    this.xray.stop();
    this.singbox.stop();
    this.naive.stopAll();
    this.mieru.stopAll();
  }

  getStatus(): NodeStatus {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const memInfo = os.totalmem() - os.freemem();
    const memPercent = (memInfo / os.totalmem()) * 100;

    // Get CPU usage (1-minute average)
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

  private getConnectionCount(): number {
    try {
      // Count TCP connections in ESTABLISHED state
      const { execSync } = require('child_process');
      const output = execSync('ss -t state established | wc -l', { encoding: 'utf-8', timeout: 3000 });
      return parseInt(output.trim()) || 0;
    } catch {
      return 0;
    }
  }
}
