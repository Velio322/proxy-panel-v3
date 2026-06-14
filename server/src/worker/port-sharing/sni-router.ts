import fs from 'fs';
import path from 'path';
import { InboundConfig, PortShareConfig } from '../types';

interface PortShareMapping {
  port: number;
  protocol: string;
  tag: string;
  host?: string;
  path?: string;
  sni: string;
  upstream: string; // internal address:port
}

/**
 * Generates SNI-based routing configs to multiplex multiple protocols on port 443.
 *
 * Strategy:
 * - HAProxy (recommended): TCP-level SNI routing, zero overhead
 * - Nginx stream: Alternative if HAProxy not available
 * - Native Xray: For inbounds that share the same core
 */
export class SNIRouter {
  private configDir: string;
  private haproxyEnabled: boolean;
  private nginxEnabled: boolean;

  constructor(configDir: string, options?: { haproxy?: boolean; nginx?: boolean }) {
    this.configDir = configDir;
    this.haproxyEnabled = options?.haproxy ?? true;
    this.nginxEnabled = options?.nginx ?? false;
  }

  /**
   * Analyze inbounds and determine which need external SNI routing.
   * Returns port-share mappings grouped by listen port.
   */
  analyzePortShares(inbounds: InboundConfig[]): Map<number, PortShareMapping[]> {
    const portGroups = new Map<number, PortShareMapping[]>();

    for (const inbound of inbounds) {
      if (!inbound.enable) continue;

      // Direct port inbounds — no sharing needed
      if (!inbound.portShares || inbound.portShares.length === 0) continue;

      for (const ps of inbound.portShares) {
        if (!ps.enable) continue;

        const mapping: PortShareMapping = {
          port: inbound.port,
          protocol: ps.protocol,
          tag: ps.tag,
          host: ps.host,
          path: ps.path,
          sni: ps.host || ps.settings?.sni || '',
          upstream: `127.0.0.1:${this.getUpstreamPort(ps)}`,
        };

        const existing = portGroups.get(inbound.port) || [];
        existing.push(mapping);
        portGroups.set(inbound.port, existing);
      }
    }

    return portGroups;
  }

  /**
   * Assign unique internal ports for each port-shared inbound.
   * External: 443 -> Internal: separate ports per protocol
   */
  getUpstreamPort(ps: PortShareConfig): number {
    // Base port 10000 + protocol offset
    const offsets: Record<string, number> = {
      'VLESS': 0,
      'VMESS': 100,
      'TROJAN': 200,
      'SHADOWSOCKS': 300,
      'HYSTERIA2': 400,
      'NAIVEPROXY': 500,
      'MIERU': 600,
      'TUIC': 700,
    };

    // Use tag hash for uniqueness within protocol
    const tagHash = this.hashCode(ps.tag) % 90;
    return 10000 + (offsets[ps.protocol] || 0) + tagHash;
  }

  /**
   * Generate HAProxy config for SNI-based TCP routing.
   *
   * Frontend: Listens on 443, inspects TLS ClientHello for SNI
   * Backend: Routes to appropriate internal port based on SNI
   */
  generateHAProxyConfig(portGroups: Map<number, PortShareMapping[]>): string {
    let config = `# ProxPanel HAProxy SNI Router
# Auto-generated — do not edit manually
# Generated: ${new Date().toISOString()}

global
    log /dev/log local0
    maxconn 100000
    tune.ssl.default-dh-param 2048
    ssl-default-bind-options no-sslv3 no-tlsv10 no-tlsv11
    ssl-default-bind-ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
    ssl-default-bind-ciphersuites TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256

defaults
    log     global
    mode    tcp
    option  tcplog
    option  dontlognull
    timeout connect 5s
    timeout client  300s
    timeout server  300s
    retries 3

`;
    let frontendId = 0;

    for (const [port, mappings] of portGroups) {
      frontendId++;
      const feName = `sni_frontend_${frontendId}`;

      config += `
# ──── Port ${port} ────
frontend ${feName}
    bind *:${port}
    mode tcp
    tcp-request inspect-delay 5s
    tcp-request content accept if { req_ssl_hello_type 1 }

`;

      // Generate ACL rules based on SNI
      const defaultMapping = mappings[0]; // fallback to first
      for (const mapping of mappings) {
        if (mapping.sni) {
          const aclName = `sni_${mapping.protocol.toLowerCase()}_${mapping.tag.replace(/[^a-zA-Z0-9]/g, '_')}`;
          config += `    acl ${aclName} req_ssl_sni -i ${mapping.sni}\n`;
          config += `    use_backend ${aclName}_backend if ${aclName}\n\n`;
        }
      }

      // Also route by path for protocols that support it (gRPC, WS)
      for (const mapping of mappings) {
        if (mapping.path) {
          const aclName = `path_${mapping.tag.replace(/[^a-zA-Z0-9]/g, '_')}`;
          config += `    acl ${aclName} path_beg ${mapping.path}\n`;
          config += `    use_backend ${aclName}_backend if ${aclName}\n\n`;
        }
      }

      // Default backend
      config += `    default_backend ${defaultMapping.tag.replace(/[^a-zA-Z0-9]/g, '_')}_backend\n\n`;

      // Backend definitions
      for (const mapping of mappings) {
        const backendName = `${mapping.protocol.toLowerCase()}_${mapping.tag.replace(/[^a-zA-Z0-9]/g, '_')}_backend`;
        config += `
backend ${backendName}
    mode tcp
    server ${backendName} ${mapping.upstream}
`;
      }
    }

    return config;
  }

  /**
   * Generate Nginx stream config for SNI routing (alternative to HAProxy).
   */
  generateNginxStreamConfig(portGroups: Map<number, PortShareMapping[]>): string {
    let config = `# ProxPanel Nginx Stream SNI Router
# Auto-generated — do not edit manually

stream {
    log_format proxy '$remote_addr [$time_local] '
                     '$protocol $status $bytes_sent $bytes_received '
                     '$session_time "$upstream_addr" '
                     '"$upstream_bytes_sent" "$upstream_bytes_received"';

    access_log /var/log/nginx/proxpanel_stream.log proxy;

`;

    for (const [port, mappings] of portGroups) {
      config += `
    # ──── Port ${port} ────
    map $ssl_preread_server_name $backend_${port} {
`;

      for (const mapping of mappings) {
        if (mapping.sni) {
          config += `        ${mapping.sni}    ${mapping.upstream};\n`;
        }
      }

      config += `        default    ${mappings[0].upstream};\n`;
      config += `    }\n\n`;

      config += `
    server {
        listen ${port};
        ssl_preread on;
        proxy_pass $backend_${port};
        proxy_protocol off;
    }
`;
    }

    config += `\n}\n`;
    return config;
  }

  /**
   * Remap inbound ports for port-shared protocols.
   * When port-sharing is active, the actual inbound listens on an internal port,
   * and the external port is handled by HAProxy/Nginx.
   */
  remapInboundPorts(inbounds: InboundConfig[]): InboundConfig[] {
    const portGroups = this.analyzePortShares(inbounds);

    if (portGroups.size === 0) return inbounds;

    const result: InboundConfig[] = [];

    for (const inbound of inbounds) {
      const portShares = portGroups.get(inbound.port);

      if (!portShares || portShares.length === 0) {
        // No port-sharing on this port, keep as-is
        result.push(inbound);
        continue;
      }

      // This inbound participates in port-sharing
      // Find its specific port share entry
      const myShare = portShares.find((ps) =>
        ps.protocol === inbound.protocol && ps.tag === inbound.tag
      );

      if (myShare) {
        // Remap to internal port
        result.push({
          ...inbound,
          port: this.getUpstreamPort(myShare),
          listen: '127.0.0.1', // Only listen locally
        });
      } else {
        // This inbound is the "default" for the shared port
        // Keep its original port but only if it's the primary
        result.push({
          ...inbound,
          listen: '127.0.0.1',
        });
      }
    }

    // Add any port-share inbounds that don't have a parent inbound
    for (const [port, mappings] of portGroups) {
      for (const mapping of mappings) {
        const exists = result.some(
          (r) => r.protocol === mapping.protocol && r.tag === mapping.tag
        );
        if (!exists) {
          result.push({
            id: `ps-${mapping.tag}`,
            protocol: mapping.protocol as any,
            tag: mapping.tag,
            port: this.getUpstreamPort(mapping),
            listen: '127.0.0.1',
            settings: {},
            stream: {},
            routing: {},
            sniffing: true,
            enable: true,
            portShares: [],
          });
        }
      }
    }

    return result;
  }

  /**
   * Write generated configs to disk and optionally reload HAProxy.
   */
  applyPortSharing(inbounds: InboundConfig[]): { haproxyConfig?: string; nginxConfig?: string } {
    const portGroups = this.analyzePortShares(inbounds);
    const result: { haproxyConfig?: string; nginxConfig?: string } = {};

    if (portGroups.size === 0) {
      console.log('[SNIRouter] No port-sharing needed');
      return result;
    }

    console.log(`[SNIRouter] Found ${portGroups.size} shared port groups`);

    if (this.haproxyEnabled) {
      const haproxyConfig = this.generateHAProxyConfig(portGroups);
      const haproxyPath = path.join(this.configDir, 'haproxy.cfg');
      fs.mkdirSync(this.configDir, { recursive: true });
      fs.writeFileSync(haproxyPath, haproxyConfig, 'utf-8');
      result.haproxyConfig = haproxyConfig;
      console.log(`[SNIRouter] HAProxy config written to ${haproxyPath}`);
    }

    if (this.nginxEnabled) {
      const nginxConfig = this.generateNginxStreamConfig(portGroups);
      const nginxPath = path.join(this.configDir, 'nginx-stream.conf');
      fs.mkdirSync(this.configDir, { recursive: true });
      fs.writeFileSync(nginxPath, nginxConfig, 'utf-8');
      result.nginxConfig = nginxConfig;
      console.log(`[SNIRouter] Nginx stream config written to ${nginxPath}`);
    }

    return result;
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
