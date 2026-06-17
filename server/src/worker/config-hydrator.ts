import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { InboundConfig, RoutingRule, XrayConfig, SingboxConfig } from './types';

/**
 * ConfigHydrator — translates DB InboundConfig objects into valid core config.json files.
 * Handles: Xray v1.8+ full config, sing-box, NaiveProxy, Mieru.
 */
export class ConfigHydrator {
  private configDir: string;

  constructor(configDir: string) {
    this.configDir = configDir;
    fs.mkdirSync(configDir, { recursive: true });
  }

  // ──── Xray Config Generation ────

  generateXrayConfig(inbounds: InboundConfig[], routing?: RoutingRule[]): XrayConfig {
    const xrayInbounds = inbounds
      .filter((i) => ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(i.protocol))
      .map((i) => this.buildXrayInbound(i));

    // Add Xray stats API inbound
    xrayInbounds.push({
      tag: 'api',
      listen: '127.0.0.1',
      port: 10085,
      protocol: 'dokodemo-door',
      settings: { address: '127.0.0.1' },
      streamSettings: {},
      sniffing: { enabled: false },
    });

    const routingRules = [
      { inboundTag: ['api'], outboundTag: 'api', type: 'field' as const },
      { type: 'field' as const, ip: ['geoip:private'], outboundTag: 'block' },
      ...(routing || []),
    ];

    return {
      log: {
        access: 'none',
        error: path.join(this.configDir, 'logs', 'xray-error.log'),
        loglevel: 'warning',
      },
      stats: {},
      api: { tag: 'api', services: ['StatsService'] },
      dns: {
        servers: [
          { address: 'https://dns.google/dns-query', domains: ['geosite:geolocation-!cn'], tag: 'google' },
          { address: 'https://1.1.1.1/dns-query', domains: ['geosite:geolocation-!cn'], tag: 'cloudflare' },
          { address: 'local', tag: 'local' },
        ],
        clientIp: '',
        tag: 'dns',
        disableCache: false,
        disableFallback: false,
        disableCacheSave: false,
        queryStrategy: 'UseIP',
        nonIPQuery: 'Drop',
        disableFallbackIfMatch: false,
        independentCache: false,
      },
      policy: {
        system: {
          statsInboundUplink: true,
          statsInboundDownlink: true,
          statsOutboundUplink: true,
          statsOutboundDownlink: true,
          statsInboundDetourUplink: false,
          statsInboundDetourDownlink: false,
          statsOutboundDetourUplink: false,
          statsOutboundDetourDownlink: false,
        },
        levels: {
          '0': {
            handshake: 4,
            connIdle: 300,
            uplinkOnly: 2,
            downlinkOnly: 5,
            statsUserUplink: true,
            statsUserDownlink: true,
            statsInboundUplink: true,
            statsInboundDownlink: true,
            statsOutboundUplink: true,
            statsOutboundDownlink: true,
            bufferFaultLambda: 12,
            bufferSizeLambda: 16,
            bufferMaxLambda: 512,
            bufferCountLambda: 32,
          },
        },
      },
      routing: {
        domainStrategy: 'IPIfNonMatch',
        domainMatcher: 'mph',
        rules: routingRules,
        balancers: [],
      },
      inbounds: xrayInbounds,
      outbounds: [
        { protocol: 'freedom', tag: 'direct' },
        { protocol: 'blackhole', tag: 'block' },
        { protocol: 'dns', tag: 'dns-out' },
      ],
    };
  }

  private buildXrayInbound(inbound: InboundConfig): any {
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
        enabled: inbound.sniffing?.enabled ?? true,
        destOverride: inbound.sniffing?.destOverride || ['http', 'tls'],
        metadataOnly: inbound.sniffing?.metadataOnly ?? false,
        routeOnly: inbound.sniffing?.routeOnly ?? false,
      },
    };

    // Protocol-specific settings
    switch (inbound.protocol) {
      case 'VLESS':
        base.settings = {
          users: [{
            id: settings.id || crypto.randomUUID(),
            flow: settings.flow || 'xtls-rprx-vision',
            email: settings.email || `${inbound.tag}@panel`,
            level: 0,
          }],
          decryption: 'none',
          fallbacks: settings.fallbacks || [],
        };
        break;

      case 'VMESS':
        base.settings = {
          users: [{
            id: settings.id || crypto.randomUUID(),
            alterId: settings.alterId || 0,
            email: settings.email || `${inbound.tag}@panel`,
            level: 0,
          }],
          disableInsecure: settings.disableInsecure ?? false,
          defaultLevel: 0,
          acceptProxyProtocol: false,
        };
        break;

      case 'TROJAN':
        base.settings = {
          password: settings.password || crypto.randomBytes(16).toString('hex'),
          email: settings.email || `${inbound.tag}@panel`,
          level: 0,
          fallbacks: settings.fallbacks || [],
        };
        break;

      case 'SHADOWSOCKS':
        base.settings = {
          method: settings.method || 'aes-256-gcm',
          password: settings.password || crypto.randomBytes(16).toString('hex'),
          network: settings.network || 'tcp,udp',
          ota: false,
          level: 0,
        };
        break;
    }

    // Stream settings (transport + security)
    this.buildStreamSettings(base, stream);

    return base;
  }

  private buildStreamSettings(base: any, stream: Record<string, any>): void {
    const network = stream.network || 'tcp';
    base.streamSettings = { network };

    // Security
    const security = stream.security || 'none';
    if (security === 'tls') {
      base.streamSettings.security = 'tls';
      base.streamSettings.tlsSettings = {
        serverName: stream.sni || '',
        fingerprint: stream.fingerprint || 'chrome',
        alpn: stream.alpn ? stream.alpn.split(',') : ['h2', 'http/1.1'],
        allowInsecure: stream.allowInsecure || false,
        minVersion: stream.minVersion || '1.2',
        maxVersion: stream.maxVersion || '1.3',
        cipherSuites: stream.cipherSuites || [],
        rejectUnknownSni: true,
        certificates: stream.certificates || [],
        enableSessionResumption: true,
        disableSystemRoot: false,
        curves: stream.curves || [],
      };
    }

    if (security === 'reality') {
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
          path: stream.wsSettings?.path || stream.path || '/',
          headers: stream.wsSettings?.headers || {},
          maxEarlyData: stream.wsSettings?.maxEarlyData || 0,
          useBrowserForwardingAgent: false,
          acceptProxyProtocol: false,
        };
        break;

      case 'grpc':
        base.streamSettings.grpcSettings = {
          serviceName: stream.grpcSettings?.serviceName || stream.serviceName || '',
          multiMode: stream.grpcSettings?.multiMode ?? false,
          idleTimeout: stream.grpcSettings?.idleTimeout || 10,
          healthCheckTimeout: stream.grpcSettings?.healthCheckTimeout || 20,
          initialWindowsSize: stream.grpcSettings?.initialStreamReceiveWindow || 0,
          userAgent: stream.grpcSettings?.userAgent || '',
          maxConcurrentStreams: stream.grpcSettings?.maxConcurrentStreams || 0,
        };
        break;

      case 'httpupgrade':
        base.streamSettings.httpupgradeSettings = {
          path: stream.httpupgradeSettings?.path || stream.path || '/',
          host: stream.httpupgradeSettings?.host || '',
          acceptProxyProtocol: stream.httpupgradeSettings?.acceptProxyProtocol ?? false,
        };
        break;

      case 'xhttp':
        base.streamSettings.xhttpSettings = {
          path: stream.xhttpSettings?.path || '',
          mode: stream.xhttpSettings?.mode || 'auto',
          extra: {
            type: stream.xhttpSettings?.extra?.type || 'auto',
            noGracefulShutdown: false,
            keepAlive: true,
            keepAliveIdleTimeout: 15,
            keepAliveMax: 100,
            maxConcurrentUploads: 16,
          },
        };
        break;

      case 'h2':
        base.streamSettings.httpSettings = {
          path: stream.httpSettings?.path || '/',
          host: stream.httpSettings?.host ? stream.httpSettings.host.split(',') : [''],
          method: stream.httpSettings?.method || 'PUT',
          headers: stream.httpSettings?.headers || {},
          passThroughUri: stream.httpSettings?.passThroughUri ?? false,
        };
        break;

      case 'kcp':
        base.streamSettings.kcpSettings = {
          header: { type: stream.kcpSettings?.headerType || 'none' },
          seed: stream.kcpSettings?.seed || '',
          nocomp: false,
          uplinkCapacity: 100,
          downlinkCapacity: 100,
          congestion: false,
          readBufferSize: 1,
          writeBufferSize: 1,
        };
        break;
    }
  }

  // ──── Sing-box Config Generation ────

  generateSingboxConfig(inbounds: InboundConfig[]): SingboxConfig {
    const singboxInbounds = inbounds
      .filter((i) => ['HYSTERIA2', 'TUIC'].includes(i.protocol))
      .map((i) => this.buildSingboxInbound(i));

    return {
      log: { level: 'warn', timestamp: true },
      dns: {
        servers: [
          { tag: 'google', address: 'tls://8.8.8.8', detour: 'direct' },
          { tag: 'local', address: 'local', detour: 'direct' },
        ],
        rules: [
          { domain_suffix: ['.ir'], server: 'local' },
        ],
      },
      inbounds: singboxInbounds,
      outbounds: [
        { type: 'direct', tag: 'direct' },
        { type: 'block', tag: 'block' },
      ],
      route: {
        rules: [{ ip_is_private: true, outbound: 'block' }],
        auto_detect_interface: true,
      },
    };
  }

  private buildSingboxInbound(inbound: InboundConfig): any {
    const settings = inbound.settings;

    if (inbound.protocol === 'HYSTERIA2') {
      return {
        type: 'hysteria2',
        tag: inbound.tag,
        listen: inbound.listen || '::',
        listen_port: inbound.port,
        users: [{
          name: settings.username || 'user',
          password: settings.password || crypto.randomBytes(16).toString('hex'),
        }],
        obfs: settings.obfs?.type && settings.obfs.type !== 'none' ? {
          type: settings.obfs.type,
          password: settings.obfs.password || '',
        } : undefined,
        tls: {
          enabled: true,
          server_name: settings.sni || '',
          alpn: ['h3'],
        },
        max_client: settings.maxClient || 16,
        max_stream: settings.maxStream || 1024,
        ignore_client_bandwidth: settings.ignoreClientBandwidth ?? false,
        bandwidth: settings.bandwidth || { up: '100 mbps', down: '100 mbps' },
        quic: {
          init_stream_receive_window: settings.quic?.initStreamReceiveWindow || 16777216,
          max_stream_receive_window: settings.quic?.maxStreamReceiveWindow || 16777216,
          init_conn_receive_window: settings.quic?.initConnReceiveWindow || 33554432,
          max_conn_receive_window: settings.quic?.maxConnReceiveWindow || 33554432,
          max_idle_timeout: settings.quic?.maxIdleTimeout || '10s',
          max_incoming_streams: settings.quic?.maxIncomingStreams || 1024,
          disable_path_mtu_discovery: settings.quic?.disablePathMTUDiscovery ?? false,
        },
        masquerade: settings.masquerade || { type: 'http', http: { serverName: settings.sni || '' } },
      };
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
        zero_rtt_handshake: settings.zero_rtt ?? false,
        tls: {
          enabled: true,
          server_name: settings.sni || '',
          alpn: ['h3'],
        },
      };
    }

    return null;
  }

  // ──── File I/O ────

  writeXrayConfig(config: XrayConfig): string {
    const logDir = path.join(this.configDir, 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const configPath = path.join(this.configDir, 'xray.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return configPath;
  }

  writeSingboxConfig(config: SingboxConfig): string {
    const configPath = path.join(this.configDir, 'singbox.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return configPath;
  }

  writeNaiveConfig(settings: any, tag: string): string {
    const configPath = path.join(this.configDir, `naive-${tag}.json`);
    fs.writeFileSync(configPath, JSON.stringify(settings, null, 2), 'utf-8');
    return configPath;
  }

  writeMieruConfig(settings: any, tag: string): string {
    const configPath = path.join(this.configDir, `mieru-${tag}.json`);
    fs.writeFileSync(configPath, JSON.stringify(settings, null, 2), 'utf-8');
    return configPath;
  }
}
