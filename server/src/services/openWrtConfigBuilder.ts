/**
 * openWrtConfigBuilder.ts — Generates uci commands and subscription configs
 * for OpenWrt routers (OpenClash, Passwall, Passwall2, ShadowsocksR).
 *
 * Converts Panel InboundConfig → OpenWrt uci commands / config files.
 */

// ══════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════

interface InboundExport {
  protocol: string;
  tag: string;
  host: string;
  port: number;
  settings: Record<string, any>;
  stream: Record<string, any>;
}

interface UciCommand {
  type: 'set' | 'add' | 'delete' | 'commit';
  path: string;
  value?: string;
}

interface OpenClashNode {
  name: string;
  type: string;
  server: string;
  port: number;
  [key: string]: any;
}

interface PasswallNode {
  name: string;
  type: string;
  server: string;
  port: number;
  password?: string;
  uuid?: string;
  [key: string]: any;
}

// ══════════════════════════════════════════════
// UCI Command Generator
// ══════════════════════════════════════════════

export class OpenWrtConfigBuilder {
  private configDir: string;

  constructor(configDir: string = '/etc/config') {
    this.configDir = configDir;
  }

  /**
   * Generate uci commands for OpenClash node configuration.
   */
  generateOpenClashUci(inbound: InboundExport): UciCommand[] {
    const s = inbound.settings;
    const st = inbound.stream || {};
    const section = `proxy_${this.hashCode(inbound.tag)}`;

    const commands: UciCommand[] = [];

    // Delete existing section
    commands.push({ type: 'delete', path: `openclash.${section}` });

    // Create section
    commands.push({ type: 'add', path: 'openclash', value: 'proxy' });

    switch (inbound.protocol) {
      case 'VLESS':
        commands.push(
          { type: 'set', path: `openclash.${section}.type`, value: 'vless' },
          { type: 'set', path: `openclash.${section}.name`, value: inbound.tag },
          { type: 'set', path: `openclash.${section}.server`, value: inbound.host },
          { type: 'set', path: `openclash.${section}.port`, value: String(inbound.port) },
          { type: 'set', path: `openclash.${section}.uuid`, value: s.id || '' },
          { type: 'set', path: `openclash.${section}.network`, value: st.network || 'tcp' },
          { type: 'set', path: `openclash.${section}.tls`, value: st.security === 'tls' || st.security === 'reality' ? '1' : '0' },
        );

        if (st.sni) commands.push({ type: 'set', path: `openclash.${section}.servername`, value: st.sni });
        if (st.fingerprint) commands.push({ type: 'set', path: `openclash.${section}.client-fingerprint`, value: st.fingerprint });
        if (s.flow) commands.push({ type: 'set', path: `openclash.${section}.flow`, value: s.flow });

        if (st.security === 'reality') {
          commands.push(
            { type: 'set', path: `openclash.${section}.reality-public-key`, value: st.publicKey || '' },
            { type: 'set', path: `openclash.${section}.reality-short-id`, value: st.shortId || '' },
          );
        }

        if (st.network === 'ws') {
          commands.push(
            { type: 'set', path: `openclash.${section}.ws-opts.path`, value: st.wsSettings?.path || '/' },
            ...(st.wsSettings?.host ? [{ type: 'set' as const, path: `openclash.${section}.ws-opts.headers.Host`, value: st.wsSettings.host }] : []),
          );
        }
        if (st.network === 'grpc') {
          commands.push({ type: 'set', path: `openclash.${section}.grpc-opts.grpc-service-name`, value: st.grpcSettings?.serviceName || '' });
        }
        break;

      case 'HYSTERIA2':
        commands.push(
          { type: 'set', path: `openclash.${section}.type`, value: 'hysteria2' },
          { type: 'set', path: `openclash.${section}.name`, value: inbound.tag },
          { type: 'set', path: `openclash.${section}.server`, value: inbound.host },
          { type: 'set', path: `openclash.${section}.port`, value: String(inbound.port) },
          { type: 'set', path: `openclash.${section}.password`, value: s.password || '' },
        );
        if (s.sni) commands.push({ type: 'set', path: `openclash.${section}.sni`, value: s.sni });
        if (s.obfs?.type && s.obfs.type !== 'none') {
          commands.push(
            { type: 'set', path: `openclash.${section}.obfs`, value: s.obfs.type },
            { type: 'set', path: `openclash.${section}.obfs-password`, value: s.obfs.password || '' },
          );
        }
        break;

      case 'TROJAN':
        commands.push(
          { type: 'set', path: `openclash.${section}.type`, value: 'trojan' },
          { type: 'set', path: `openclash.${section}.name`, value: inbound.tag },
          { type: 'set', path: `openclash.${section}.server`, value: inbound.host },
          { type: 'set', path: `openclash.${section}.port`, value: String(inbound.port) },
          { type: 'set', path: `openclash.${section}.password`, value: s.password || '' },
          { type: 'set', path: `openclash.${section}.tls`, value: '1' },
        );
        if (s.sni) commands.push({ type: 'set', path: `openclash.${section}.servername`, value: s.sni });
        if (st.fingerprint) commands.push({ type: 'set', path: `openclash.${section}.client-fingerprint`, value: st.fingerprint });
        break;
    }

    commands.push({ type: 'commit', path: 'openclash' });
    return commands;
  }

  /**
   * Generate Passwall node configuration JSON.
   */
  generatePasswallConfig(inbound: InboundExport): PasswallNode {
    const s = inbound.settings;
    const st = inbound.stream || {};

    const base: PasswallNode = {
      name: inbound.tag,
      type: inbound.protocol.toLowerCase(),
      server: inbound.host,
      port: inbound.port,
    };

    switch (inbound.protocol) {
      case 'VLESS':
        base.uuid = s.id || '';
        base.flow = s.flow || '';
        base.tls = st.security === 'tls' || st.security === 'reality' ? '1' : '0';
        base.tls_host = st.sni || '';
        base.fingerprint = st.fingerprint || 'chrome';
        base.reality_public_key = st.publicKey || '';
        base.reality_short_id = st.shortId || '';
        base.network = st.network || 'tcp';
        if (st.network === 'ws') {
          base.network_path = st.wsSettings?.path || '/';
          base.network_host = st.wsSettings?.host || '';
        }
        if (st.network === 'grpc') {
          base.network_serviceName = st.grpcSettings?.serviceName || '';
        }
        break;

      case 'HYSTERIA2':
        base.password = s.password || '';
        base.sni = s.sni || '';
        base.obfs = s.obfs?.type || 'none';
        base.obfs_password = s.obfs?.password || '';
        break;

      case 'TROJAN':
        base.password = s.password || '';
        base.tls = '1';
        base.tls_host = st.sni || '';
        base.fingerprint = st.fingerprint || 'chrome';
        break;

      case 'SHADOWSOCKS':
        base.cipher = s.method || 'aes-256-gcm';
        base.password = s.password || '';
        break;
    }

    return base;
  }

  /**
   * Generate full OpenClash config.yaml content.
   */
  generateOpenClashYaml(inbounds: InboundExport[]): string {
    let yaml = `# ProxPanel → OpenClash Config
# Generated: ${new Date().toISOString()}
# Compatible with: OpenClash / Clash Meta (mihomo)

mixed-port: 7890
allow-lan: true
bind-address: '*'
mode: rule
log-level: info

dns:
  enable: true
  listen: 0.0.0.0:53
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - https://dns.google/dns-query
    - https://1.1.1.1/dns-query
  fallback:
    - tls://8.8.8.8
    - https://dns.google/dns-query
  fallback-filter:
    geoip: true
    geoip-code: CN

proxies:
`;

    for (const inbound of inbounds) {
      const node = this.toOpenClashProxy(inbound);
      if (node) {
        yaml += `  - ${this.objectToYaml(node, 2)}\n`;
      }
    }

    yaml += `
proxy-groups:
  - name: PROXY
    type: select
    proxies:
${inbounds.map((i) => `      - ${i.tag}`).join('\n')}

  - name: AUTO
    type: url-test
    proxies:
${inbounds.map((i) => `      - ${i.tag}`).join('\n')}
    url: https://www.gstatic.com/generate_204
    interval: 300

rules:
  - GEOIP,CN,DIRECT
  - GEOSITE,category-ads-all,REJECT
  - GEOSITE,category-malware,REJECT
  - GEOSITE,telegram,PROXY
  - GEOSITE,google,PROXY
  - MATCH,PROXY
`;

    return yaml;
  }

  /**
   * Generate Passwall subscription config (JSON).
   */
  generatePasswallSubscription(inbounds: InboundExport[]): string {
    const nodes = inbounds.map((i) => this.generatePasswallConfig(i));
    return JSON.stringify(nodes, null, 2);
  }

  /**
   * Generate ShadowsocksR subscription format.
   */
  generateSSRSubscription(inbounds: InboundExport[]): string {
    const lines: string[] = [];

    for (const inbound of inbounds) {
      if (inbound.protocol !== 'SHADOWSOCKS') continue;

      const s = inbound.settings;
      const encoded = Buffer.from(`${inbound.host}:${inbound.port}:${s.method || 'aes-256-gcm'}:${s.password || ''}:${s.proto || 'origin'}`).toString('base64');
      lines.push(`ssr://${encoded}`);
    }

    return Buffer.from(lines.join('\n')).toString('base64');
  }

  /**
   * Generate Clash Meta / sing-box compatible config.
   */
  generateSingboxSubscription(inbounds: InboundExport[]): string {
    const outbounds = inbounds.map((i) => this.toSingboxOutbound(i)).filter(Boolean);
    return JSON.stringify({ outbounds }, null, 2);
  }

  /**
   * Generate base64-encoded subscription (universal).
   */
  generateBase64Subscription(inbounds: InboundExport[]): string {
    const lines: string[] = [];

    for (const inbound of inbounds) {
      const uri = this.toUri(inbound);
      if (uri) lines.push(uri);
    }

    return Buffer.from(lines.join('\n')).toString('base64');
  }

  // ──── Converters ────

  private toOpenClashProxy(inbound: InboundExport): OpenClashNode | null {
    const s = inbound.settings;
    const st = inbound.stream || {};

    switch (inbound.protocol) {
      case 'VLESS':
        return {
          name: inbound.tag,
          type: 'vless',
          server: inbound.host,
          port: inbound.port,
          uuid: s.id || '',
          flow: s.flow || '',
          tls: st.security === 'tls' || st.security === 'reality',
          servername: st.sni || '',
          'client-fingerprint': st.fingerprint || 'chrome',
          ...(st.security === 'reality' && {
            'reality-public-key': st.publicKey || '',
            'reality-short-id': st.shortId || '',
          }),
          network: st.network || 'tcp',
          ...(st.network === 'ws' && { 'ws-opts': { path: st.wsSettings?.path || '/', headers: st.wsSettings?.host ? { Host: st.wsSettings.host } : {} } }),
          ...(st.network === 'grpc' && { 'grpc-opts': { 'grpc-service-name': st.grpcSettings?.serviceName || '' } }),
        };

      case 'HYSTERIA2':
        return {
          name: inbound.tag,
          type: 'hysteria2',
          server: inbound.host,
          port: inbound.port,
          password: s.password || '',
          sni: s.sni || '',
          ...(s.obfs?.type && s.obfs.type !== 'none' && { obfs: s.obfs.type, 'obfs-password': s.obfs.password || '' }),
        };

      case 'TROJAN':
        return {
          name: inbound.tag,
          type: 'trojan',
          server: inbound.host,
          port: inbound.port,
          password: s.password || '',
          sni: st.sni || '',
          'client-fingerprint': st.fingerprint || 'chrome',
        };

      default:
        return null;
    }
  }

  private toSingboxOutbound(inbound: InboundExport): any {
    const s = inbound.settings;
    const st = inbound.stream || {};

    switch (inbound.protocol) {
      case 'VLESS':
        return {
          type: 'vless',
          tag: inbound.tag,
          server: inbound.host,
          server_port: inbound.port,
          uuid: s.id || '',
          flow: s.flow || '',
          tls: {
            enabled: st.security === 'tls' || st.security === 'reality',
            server_name: st.sni || '',
            utls: { enabled: true, fingerprint: st.fingerprint || 'chrome' },
            ...(st.security === 'reality' && {
              reality: { enabled: true, public_key: st.publicKey || '', short_id: st.shortId || '' },
            }),
          },
          ...(st.network === 'ws' && { transport: { type: 'ws', path: st.wsSettings?.path || '/' } }),
          ...(st.network === 'grpc' && { transport: { type: 'grpc', service_name: st.grpcSettings?.serviceName || '' } }),
        };

      case 'HYSTERIA2':
        return {
          type: 'hysteria2',
          tag: inbound.tag,
          server: inbound.host,
          server_port: inbound.port,
          password: s.password || '',
          tls: { enabled: true, server_name: s.sni || '' },
          ...(s.obfs?.type && s.obfs.type !== 'none' && { obfs: { type: s.obfs.type, password: s.obfs.password || '' } }),
        };

      case 'TROJAN':
        return {
          type: 'trojan',
          tag: inbound.tag,
          server: inbound.host,
          server_port: inbound.port,
          password: s.password || '',
          tls: { enabled: true, server_name: st.sni || '' },
        };

      default:
        return null;
    }
  }

  private toUri(inbound: InboundExport): string | null {
    const s = inbound.settings;
    const st = inbound.stream || {};

    switch (inbound.protocol) {
      case 'VLESS': {
        const params = new URLSearchParams();
        params.set('security', st.security || 'none');
        params.set('type', st.network || 'tcp');
        if (st.sni) params.set('sni', st.sni);
        if (st.fingerprint) params.set('fp', st.fingerprint);
        if (st.publicKey) params.set('pbk', st.publicKey);
        if (st.shortId) params.set('sid', st.shortId);
        if (st.spiderX) params.set('spx', st.spiderX);
        if (s.flow) params.set('flow', s.flow);
        if (st.network === 'ws' && st.wsSettings?.path) params.set('path', st.wsSettings.path);
        if (st.network === 'grpc' && st.grpcSettings?.serviceName) params.set('serviceName', st.grpcSettings.serviceName);
        return `vless://${s.id || ''}@${inbound.host}:${inbound.port}?${params.toString()}#${encodeURIComponent(inbound.tag)}`;
      }

      case 'HYSTERIA2': {
        const params = new URLSearchParams();
        if (s.sni) params.set('sni', s.sni);
        if (s.obfs?.type && s.obfs.type !== 'none') {
          params.set('obfs', s.obfs.type);
          if (s.obfs.password) params.set('obfs-password', s.obfs.password);
        }
        return `hy2://${s.password || ''}@${inbound.host}:${inbound.port}?${params.toString()}#${encodeURIComponent(inbound.tag)}`;
      }

      case 'TROJAN': {
        const params = new URLSearchParams();
        if (st.sni) params.set('sni', st.sni);
        if (st.fingerprint) params.set('fp', st.fingerprint);
        return `trojan://${s.password || ''}@${inbound.host}:${inbound.port}?${params.toString()}#${encodeURIComponent(inbound.tag)}`;
      }

      case 'SHADOWSOCKS': {
        const encoded = Buffer.from(`${s.method || 'aes-256-gcm'}:${s.password || ''}`).toString('base64');
        return `ss://${encoded}@${inbound.host}:${inbound.port}#${encodeURIComponent(inbound.tag)}`;
      }

      default:
        return null;
    }
  }

  private objectToYaml(obj: any, indent: number): string {
    const pad = ' '.repeat(indent);
    let yaml = '';
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'boolean') {
        yaml += `${pad}${key}: ${value ? 'true' : 'false'}\n`;
      } else if (typeof value === 'number') {
        yaml += `${pad}${key}: ${value}\n`;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        yaml += `${pad}${key}:\n${this.objectToYaml(value, indent + 2)}\n`;
      } else if (Array.isArray(value)) {
        yaml += `${pad}${key}:\n`;
        for (const item of value) {
          yaml += `${pad}  - ${item}\n`;
        }
      } else {
        yaml += `${pad}${key}: "${value}"\n`;
      }
    }
    return yaml;
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
