import fs from 'fs';
import path from 'path';
import { InboundConfig } from '../types';

interface PortGroup {
  port: number;
  protocol: string;
  tag: string;
  host?: string;
  path?: string;
  sni: string;
  upstream: string;
  upstreamPort: number;
}

// Protocol → internal port offset mapping
const PROTOCOL_OFFSETS: Record<string, number> = {
  VLESS: 0, VMESS: 100, TROJAN: 200, SHADOWSOCKS: 300,
  HYSTERIA2: 400, NAIVEPROXY: 500, MIERU: 600, TUIC: 700,
};

const INTERNAL_BASE_PORT = 10000;

/**
 * PortSharingEngine — handles SNI-based multiplexing on shared ports.
 * Generates HAProxy configs for TCP-level SNI routing.
 */
export class PortSharingEngine {
  private configDir: string;
  private enabled: boolean;
  private haproxyPath: string;

  constructor(configDir: string, enabled: boolean, haproxyPath: string = '/usr/sbin/haproxy') {
    this.configDir = configDir;
    this.enabled = enabled;
    this.haproxyPath = haproxyPath;
  }

  /**
   * Analyze inbounds and find those that need port-sharing (multiple protocols on same port).
   */
  analyze(inbounds: InboundConfig[]): Map<number, PortGroup[]> {
    const portMap = new Map<number, InboundConfig[]>();

    // Group inbounds by their original port
    for (const inb of inbounds) {
      if (!inb.enable) continue;
      if (!portMap.has(inb.port)) portMap.set(inb.port, []);
      portMap.get(inb.port)!.push(inb);
    }

    const result = new Map<number, PortGroup[]>();

    for (const [port, portInbounds] of portMap) {
      const protocols = new Set(portInbounds.map((i) => i.protocol));
      if (protocols.size <= 1) continue; // No sharing needed — single protocol on port

      // Multiple protocols on same port — need SNI routing
      const groups: PortGroup[] = [];
      for (const inb of portInbounds) {
        const settings = inb.settings || {};
        const stream = inb.stream || {};
        groups.push({
          port,
          protocol: inb.protocol,
          tag: inb.tag,
          host: stream.sni || settings.sni,
          path: stream.grpcSettings?.serviceName || stream.wsSettings?.path,
          sni: stream.sni || settings.sni || '',
          upstream: '127.0.0.1',
          upstreamPort: this.getUpstreamPort(inb),
        });
      }

      result.set(port, groups);
    }

    return result;
  }

  /**
   * Assign unique internal port for a port-shared inbound.
   * External :443 → Internal :10000+offset+hash
   */
  getUpstreamPort(inbound: InboundConfig): number {
    const offset = PROTOCOL_OFFSETS[inbound.protocol] || 0;
    const tagHash = this.hashCode(inbound.tag) % 90;
    return INTERNAL_BASE_PORT + offset + tagHash;
  }

  /**
   * Remap inbound ports for port-shared protocols.
   * The actual inbound listens on 127.0.0.1:10xxx (internal).
   * External port is handled by HAProxy.
   */
  remapPorts(inbounds: InboundConfig[]): InboundConfig[] {
    if (!this.enabled) return inbounds.map((i) => ({ ...i }));

    const portGroups = this.analyze(inbounds);
    if (portGroups.size === 0) return inbounds.map((i) => ({ ...i }));

    const result: InboundConfig[] = [];
    const processed = new Set<string>();

    for (const inb of inbounds) {
      const groups = portGroups.get(inb.port);
      if (!groups || groups.length === 0) {
        result.push(inb);
        continue;
      }

      const myGroup = groups.find((g) => g.protocol === inb.protocol && g.tag === inb.tag);
      if (myGroup) {
        result.push({ ...inb, port: myGroup.upstreamPort, listen: '127.0.0.1' });
        processed.add(`${inb.protocol}:${inb.tag}`);
      }
    }

    return result;
  }

  /**
   * Generate complete HAProxy configuration for SNI-based TCP routing.
   */
  generateHAProxyConfig(portGroups: Map<number, PortGroup[]>): string {
    let config = `# ══════════════════════════════════════════════
# ProxPanel HAProxy SNI Router
# Auto-generated — do not edit manually
# Generated: ${new Date().toISOString()}
# ══════════════════════════════════════════════

global
    log /dev/log local0
    log /dev/log local1 notice
    maxconn 200000
    tune.ssl.default-dh-param 2048
    ssl-default-bind-options no-sslv3 no-tlsv10 no-tlsv11
    ssl-default-bind-ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384
    ssl-default-bind-ciphersuites TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256
    stats socket /var/run/haproxy.sock mode 660 level admin expose-fd listeners
    stats timeout 30s

defaults
    log     global
    mode    tcp
    option  tcplog
    option  dontlognull
    option  clitcpka
    option  srvtcpka
    timeout connect 5s
    timeout client  300s
    timeout server  300s
    timeout tunnel 3600s
    retries 3

# ══════════════════════════════════════════════
# Stats endpoint
# ══════════════════════════════════════════════
listen stats
    bind *:8404
    mode http
    stats enable
    stats uri /stats
    stats refresh 10s
    stats auth proxpanel:proxpanel_stats

`;

    let frontendIdx = 0;

    for (const [port, groups] of portGroups) {
      frontendIdx++;
      const feName = `sni_frontend_${frontendIdx}`;
      const allSnis = groups.map((g) => g.sni).filter(Boolean);

      config += `
# ──── Port ${port} (${groups.length} protocols) ────
frontend ${feName}
    bind *:${port}
    mode tcp
    tcp-request inspect-delay 5s
    tcp-request content accept if { req_ssl_hello_type 1 }
`;

      // Generate ACL rules for each protocol by SNI
      const aclEntries: { aclName: string; sni: string; backendName: string }[] = [];

      for (const group of groups) {
        if (!group.sni) continue;
        const safeTag = group.tag.replace(/[^a-zA-Z0-9]/g, '_');
        const aclName = `sni_${group.protocol.toLowerCase()}_${safeTag}`;
        const backendName = `${safeTag}_backend`;

        aclEntries.push({ aclName, sni: group.sni, backendName });
        config += `    acl ${aclName} req_ssl_sni -i ${group.sni}\n`;
      }

      // Also route by gRPC service name or WS path for non-SNI protocols
      for (const group of groups) {
        if (!group.path) continue;
        const safeTag = group.tag.replace(/[^a-zA-Z0-9]/g, '_');
        const aclName = `path_${safeTag}`;
        const backendName = `${safeTag}_backend`;

        aclEntries.push({ aclName, sni: group.path, backendName });
        config += `    acl ${aclName} req_ssl_sni -i ${group.path}\n`;
      }

      config += '\n';

      // Use rules (in order of specificity)
      for (const entry of aclEntries) {
        config += `    use_backend ${entry.backendName} if ${entry.aclName}\n`;
      }

      // Default backend: first group
      const defaultGroup = groups[0];
      const defaultBackend = defaultGroup.tag.replace(/[^a-zA-Z0-9]/g, '_') + '_backend';
      config += `    default_backend ${defaultBackend}\n`;

      // Backend definitions
      for (const group of groups) {
        const safeTag = group.tag.replace(/[^a-zA-Z0-9]/g, '_');
        const backendName = `${safeTag}_backend`;

        config += `
backend ${backendName}
    mode tcp
    balance roundrobin
    option ssl-hello-chk
    server ${backendName} ${group.upstream}:${group.upstreamPort} check inter 10s rise 2 fall 3
`;
      }
    }

    return config;
  }

  /**
   * Generate Nginx stream config (alternative to HAProxy).
   */
  generateNginxStreamConfig(portGroups: Map<number, PortGroup[]>): string {
    let config = `# ══════════════════════════════════════════════
# ProxPanel Nginx Stream SNI Router
# Auto-generated — do not edit manually
# ══════════════════════════════════════════════

stream {
    log_format proxy '$remote_addr [$time_local] '
                     '$protocol $status $bytes_sent $bytes_received '
                     '$session_time "$upstream_addr" '
                     '"$upstream_bytes_sent" "$upstream_bytes_received"';

    access_log /var/log/proxpanel_stream.log proxy;

    # SSL session cache
    ssl_session_cache shared:STREAM_SSL:10m;
    ssl_session_timeout 10m;
`;

    for (const [port, groups] of portGroups) {
      config += `
    # ──── Port ${port} (${groups.length} protocols) ────
    map $ssl_preread_server_name $backend_${port} {
`;
      for (const group of groups) {
        if (group.sni) {
          config += `        ${group.sni}    ${group.upstream}:${group.upstreamPort};\n`;
        }
      }
      config += `        default    ${groups[0].upstream}:${groups[0].upstreamPort};\n`;
      config += `    }

    server {
        listen ${port};
        ssl_preread on;
        proxy_pass $backend_${port};
        proxy_protocol off;
    }
`;
    }

    config += '\n}\n';
    return config;
  }

  // ──── HAProxy Process Management ────

  writeHAProxyConfig(config: string): void {
    const configPath = path.join(this.configDir, 'haproxy.cfg');
    fs.mkdirSync(this.configDir, { recursive: true });
    fs.writeFileSync(configPath, config, 'utf-8');
    console.log(`[PortSharing] HAProxy config written to ${configPath}`);
  }

  reloadHAProxy(): boolean {
    try {
      const { execSync } = require('child_process');
      // Validate config first
      execSync(`${this.haproxyPath} -c -f ${path.join(this.configDir, 'haproxy.cfg')}`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      // Reload
      execSync(`${this.haproxyPath} -sf $(cat /var/run/haproxy.pid 2>/dev/null || echo 0) -f ${path.join(this.configDir, 'haproxy.cfg')}`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      console.log('[PortSharing] HAProxy reloaded');
      return true;
    } catch (error: any) {
      console.error(`[PortSharing] HAProxy reload failed: ${error.message}`);
      return false;
    }
  }

  stopHAProxy(): void {
    try {
      const { execSync } = require('child_process');
      execSync('kill $(cat /var/run/haproxy.pid 2>/dev/null) 2>/dev/null || true', {
        encoding: 'utf-8',
        timeout: 5000,
      });
      console.log('[PortSharing] HAProxy stopped');
    } catch {}
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
