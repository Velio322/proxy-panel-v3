import { z } from 'zod';

// ══════════════════════════════════════════════════════════════
// PROXPANEL DATA MATRIX v2.0
// 100% coverage: Xray-core v1.8+, Hysteria2, NaiveProxy, Mieru
// ══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// 1. SNIFFING CONFIGURATION
// ──────────────────────────────────────────────

export interface SniffingConfig {
  enabled: boolean;
  destOverride: ('http' | 'tls' | 'quic' | 'stun' | 'dns' | 'bittorrent')[];
  metadataOnly: boolean;
  routeOnly: boolean;
  domainsExcluded: string[];
}

export const sniffingSchema = z.object({
  enabled: z.boolean().default(true),
  destOverride: z.array(z.enum(['http', 'tls', 'quic', 'stun', 'dns', 'bittorrent'])).default(['http', 'tls']),
  metadataOnly: z.boolean().default(false),
  routeOnly: z.boolean().default(false),
  domainsExcluded: z.array(z.string()).default([]),
});

// ──────────────────────────────────────────────
// 2. TRANSPORT CONFIGURATIONS
// ──────────────────────────────────────────────

export interface TcpSettings {
  acceptProxyProtocol: boolean;
  header: {
    type: 'none' | 'http';
    request?: {
      version: string;
      method: string;
      path: string[];
      headers: Record<string, string[]>;
    };
    response?: {
      version: string;
      status: string;
      reason: string;
      headers: Record<string, string[]>;
    };
  };
  security: 'none' | 'reality';
  realitySettings?: RealitySettings;
}

export interface WsSettings {
  path: string;
  headers: Record<string, string>;
  maxEarlyData: number;
  useBrowserForwardingAgent: boolean;
  acceptProxyProtocol: boolean;
}

export interface HttpSettings {
  host: string[];
  path: string;
  method: string;
  headers: Record<string, string[]>;
  passThroughUri: boolean;
}

export interface QuicSettings {
  security: string;
  key: string;
  header: {
    type: 'none' | 'srtp' | 'utp' | 'wechat-video' | 'dtls' | 'wireguard';
  };
}

export interface GrpcSettings {
  serviceName: string;
  multiMode: boolean;
  idleTimeout: number;
  healthCheckTimeout: number;
  initialWindowsSize: number;
  userAgent: string;
  maxConcurrentStreams: number;
}

export interface HttpUpgradeSettings {
  path: string;
  host: string;
  acceptProxyProtocol: boolean;
}

export interface XhttpSettings {
  path: string;
  mode: 'auto' | 'packet-up' | 'stream-up';
  extra: {
    type: 'auto' | 'packet-up' | 'stream-up';
    noGracefulShutdown: boolean;
    keepAlive: boolean;
    keepAliveIdleTimeout: number;
    keepAliveMax: number;
    maxConcurrentUploads: number;
  };
}

// ──────────────────────────────────────────────
// 3. REALITY SETTINGS
// ──────────────────────────────────────────────

export interface RealitySettings {
  serverName: string;
  fingerprint: string;
  publicKey: string;
  shortId: string;
  spiderX: string;
  dest: string;
  serverNames: string[];
  mKcpSettings?: {
    header: { type: string };
    seed: string;
  };
}

// ──────────────────────────────────────────────
// 4. TLS SETTINGS
// ──────────────────────────────────────────────

export interface TlsSettings {
  serverName: string;
  allowInsecure: boolean;
  alpn: string[];
  fingerprint: string;
  serverNameOrigin?: string;
  minVersion: '1.0' | '1.1' | '1.2' | '1.3';
  maxVersion: '1.0' | '1.1' | '1.2' | '1.3';
  cipherSuites: string[];
  rejectUnknownSni: boolean;
  certificates: TlsCertificate[];
  enableSessionResumption: boolean;
  disableSystemRoot: boolean;
  curves: string[];
}

export interface TlsCertificate {
  ocspStapling: boolean;
  useSystemDir: boolean;
  certificateFile: string;
  keyFile: string;
  certificateFileBase64?: string;
  keyFileBase64?: string;
}

// ──────────────────────────────────────────────
// 5. VLESS INBOUND
// ──────────────────────────────────────────────

export interface VlessInboundSettings {
  users: VlessUser[];
  decryption: 'none';
  fallbacks: VlessFallback[];
}

export interface VlessUser {
  id: string;
  email: string;
  flow: '' | 'xtls-rprx-vision' | 'xtls-rprx-direct' | 'xtls-rprx-splice';
  level: number;
  iv?: string;
  keyboard?: string;
}

export interface VlessFallback {
  name?: string;
  alpn?: string;
  path?: string;
  dest: number | string;
  xver: number;
}

// ──────────────────────────────────────────────
// 6. VMESS INBOUND
// ──────────────────────────────────────────────

export interface VmessInboundSettings {
  users: VmessUser[];
  disableInsecure: boolean;
  defaultLevel: number;
  acceptProxyProtocol: boolean;
}

export interface VmessUser {
  id: string;
  alterId: number;
  email: string;
  level: number;
}

// ──────────────────────────────────────────────
// 7. TROJAN INBOUND
// ──────────────────────────────────────────────

export interface TrojanInboundSettings {
  password: string;
  email: string;
  level: number;
  fallbacks: TrojanFallback[];
}

export interface TrojanFallback {
  name?: string;
  alpn?: string;
  path?: string;
  dest: number | string;
  xver: number;
}

// ──────────────────────────────────────────────
// 8. SHADOWSOCKS INBOUND
// ──────────────────────────────────────────────

export interface ShadowsocksInboundSettings {
  method: string;
  password: string;
  network: 'tcp' | 'udp' | 'tcp,udp';
  ota: boolean;
  level: number;
}

// ──────────────────────────────────────────────
// 9. HYSTERIA2 INBOUND
// ──────────────────────────────────────────────

export interface Hysteria2InboundSettings {
  users: Hysteria2User[];
  obfs?: Hysteria2Obfs;
  maxClient: number;
  maxStream: number;
  streamBehavior?: string;
  ignoreClientBandwidth: boolean;
  bandwidth: {
    up: string;
    down: string;
  };
  quic: {
    initStreamReceiveWindow: number;
    maxStreamReceiveWindow: number;
    initConnReceiveWindow: number;
    maxConnReceiveWindow: number;
    maxIdleTimeout: string;
    maxIncomingStreams: number;
    disablePathMTUDiscovery: boolean;
    initialStreamReceiveWindow: number;
    initialConnReceiveWindow: number;
    maxStreamSendWindow?: number;
    maxConnSendWindow?: number;
  };
  masquerade: {
    type: 'http' | 'random';
    http?: {
      serverName: string;
      serverPort?: number;
    };
  };
}

export interface Hysteria2User {
  name: string;
  password: string;
  auth?: string;
  authStr?: string;
}

export interface Hysteria2Obfs {
  type: 'salamander' | 'xplus' | string;
  password: string;
}

// ──────────────────────────────────────────────
// 10. NAIVEPROXY CONFIGURATION
// ──────────────────────────────────────────────

export interface NaiveProxySettings {
  proxy: string;
  'cert-dir': string;
  'in-nonce': string;
  'in-proto': 'quic' | 'tcp';
  'out-nonce': string;
  'out-proto': 'quic' | 'tcp';
  ciphers: string;
  'handshake-timeout': number;
  'idle-timeout': number;
  'log-level': 'info' | 'warning' | 'error' | 'quiet';
  'padding': boolean;
  'padding-length': number;
  'padding-mode': 'fixed' | 'random';
  'tcp-mptcp': boolean;
  'tcp-mptcp-multipath': boolean;
  'tcp-fastopen': boolean;
  'tcp-fastopen-queue-length': number;
  'keepalive': boolean;
  'keepalive-timeout': number;
  'max-retries': number;
  'retry-delay': number;
  'dns-servers': string[];
  'dns-over-tls': boolean;
  'dns-over-https': boolean;
  'dns-cache-ttl': number;
  'custom-headers': Record<string, string>;
  'session-reuse': boolean;
  'max-concurrent-connections': number;
  'http-proxy'?: {
    enabled: boolean;
    listen: string;
    port: number;
  };
  'socks5-proxy'?: {
    enabled: boolean;
    listen: string;
    port: number;
    username?: string;
    password?: string;
  };
}

// ──────────────────────────────────────────────
// 11. MIERU CONFIGURATION
// ──────────────────────────────────────────────

export interface MieruSettings {
  port: number;
  portRange: number[];
  socks5: {
    port: number;
    mode: 'reverse-tunnel' | 'direct';
  };
  http: {
    port: number;
  };
  users: MieruUser[];
  authentication: 'password' | 'checksum';
  bindAddress: string;
  loggingLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  sessionPlacement: 'random' | 'sequential' | 'least-connections';
  sequencePlacement: 'random' | 'sequential' | 'least-connections';
  tcpMptcp: boolean;
  tcpMptcpMultipath: boolean;
  tcpFastOpen: boolean;
  tcpKeepAlive: boolean;
  tcpKeepAliveIdle: number;
  tcpKeepAliveCount: number;
  tcpKeepAliveInterval: number;
  tcpUserTimeout: number;
  tcpLinger: number;
  tcpNoDelay: boolean;
  tcpQuickAck: boolean;
  tcpCork: boolean;
  udpTimeout: number;
  bufferConfig: {
    readBufferSize: number;
    writeBufferSize: number;
    readBufferCount: number;
    writeBufferCount: number;
  };
}

export interface MieruUser {
  name: string;
  password: string;
}

// ──────────────────────────────────────────────
// 12. ROUTING
// ──────────────────────────────────────────────

export interface RoutingRule {
  id?: string;
  type: 'field' | 'logical';
  domain?: string[];
  domainMatcher?: string;
  ip?: string[];
  port?: string | number;
  sourcePort?: string | number;
  source?: string[];
  inboundTag?: string[];
  protocol?: ('http' | 'tls' | 'bittorrent' | 'stun' | 'dns' | 'quic' | 'sip')[];
  outboundTag: string;
  balancerTag?: string;
  negate?: boolean;
  email?: string;
  user?: string[];
  attrs?: string;
  network?: 'tcp' | 'udp' | 'tcp,udp';
}

export interface RoutingRuleLogical extends Omit<RoutingRule, 'type'> {
  type: 'logical';
  mode: 'and' | 'or';
  rules: RoutingRule[];
}

export interface Balancer {
  tag: string;
  selector: string[];
  strategy: {
    type: 'roundrobin' | 'leastping' | 'leastload' | 'lowestload' | 'random' | 'lru' | 'wrurl';
    url?: string;
    interval?: string;
  };
  healthcheck?: {
    enable: boolean;
    interval: string;
    url: string;
    lazy: boolean;
  };
}

export interface RoutingConfig {
  domainStrategy: 'AsIs' | 'IPIfNonMatch' | 'IPOnDemand';
  domainMatcher: 'linear' | 'mph';
  rules: (RoutingRule | RoutingRuleLogical)[];
  balancers: Balancer[];
}

// ──────────────────────────────────────────────
// 13. NODE SETTINGS
// ──────────────────────────────────────────────

export interface NodeSettings {
  log: {
    access: string | 'none';
    error: string;
    loglevel: 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'none';
  };
  stats: Record<string, any>;
  api: {
    tag: string;
    services: ('StatsService' | 'HandlerService' | 'LoggerService')[];
  };
  dns: DnsConfig;
  policy: PolicyConfig;
  transport: TransportConfig;
  routing: RoutingConfig;
}

export interface DnsConfig {
  servers: DnsServer[];
  clientIp: string;
  tag: string;
  disableCache: boolean;
  disableFallback: boolean;
  disableCacheSave: boolean;
  queryStrategy: 'UseIP' | 'UseIPv4' | 'UseIPv6';
  nonIPQuery: 'Drop' | 'Reject' | 'Skip';
  disableFallbackIfMatch: boolean;
  independentCache: boolean;
}

export interface DnsServer {
  address: string;
  port?: number;
  domains?: string[];
  expectIPs?: string[];
  clientIp?: string;
  skipFallback?: boolean;
  disableCache?: boolean;
  disableCacheSave?: boolean;
  cacheSize?: number;
  queryStrategy?: 'UseIP' | 'UseIPv4' | 'UseIPv6';
  tag: string;
  detour?: string;
  addressResolver?: string;
}

export interface PolicyConfig {
  system: {
    statsInboundUplink: boolean;
    statsInboundDownlink: boolean;
    statsOutboundUplink: boolean;
    statsOutboundDownlink: boolean;
    statsInboundDetourUplink: boolean;
    statsInboundDetourDownlink: boolean;
    statsOutboundDetourUplink: boolean;
    statsOutboundDetourDownlink: boolean;
  };
  levels: Record<string, {
    handshake: number;
    connIdle: number;
    uplinkOnly: number;
    downlinkOnly: number;
    statsUserUplink: boolean;
    statsUserDownlink: boolean;
    statsUserLinkUplink?: boolean;
    statsUserLinkDownlink?: boolean;
    statsInboundUplink: boolean;
    statsInboundDownlink: boolean;
    statsOutboundUplink: boolean;
    statsOutboundDownlink: boolean;
    bufferFaultLambda: number;
    bufferSizeLambda: number;
    bufferMaxLambda: number;
    bufferCountLambda: number;
    bufferSize?: number;
  }>;
}

export interface TransportConfig {
  kcpSettings: {
    nocomp: boolean;
    uplinkCapacity: number;
    downlinkCapacity: number;
    congestion: boolean;
    readBufferSize: number;
    writeBufferSize: number;
    header: {
      type: 'none' | 'srtp' | 'utp' | 'wechat-video' | 'dtls' | 'wireguard';
      request?: {
        version: string;
        method: string;
        path: string[];
        headers: Record<string, string[]>;
      };
      response?: {
        version: string;
        status: string;
        reason: string;
        headers: Record<string, string[]>;
      };
    };
    seed: string;
  };
  tcpSettings: TcpSettings;
  wsSettings: WsSettings;
  httpSettings: HttpSettings;
  grpcSettings: GrpcSettings;
}

// ──────────────────────────────────────────────
// 14. FULL INBOUND CONFIG (Unified)
// ──────────────────────────────────────────────

export interface InboundConfig {
  id: string;
  protocol: Protocol;
  tag: string;
  port: number;
  listen: string;
  settings: Record<string, any>;
  stream: StreamConfig;
  routing: RoutingRule[];
  sniffing: SniffingConfig;
  remark?: string;
  enable: boolean;
  portShares: PortShareConfig[];
  node?: { id: string; name: string; host: string; status: string };
}

export type Protocol = 'VLESS' | 'VMESS' | 'TROJAN' | 'SHADOWSOCKS' | 'HYSTERIA2' | 'NAIVEPROXY' | 'MIERU' | 'TUIC';

export interface StreamConfig {
  security: 'none' | 'tls' | 'reality';
  network: 'tcp' | 'ws' | 'grpc' | 'httpupgrade' | 'xhttp' | 'h2' | 'kcp';
  sni: string;
  fingerprint: string;
  alpn?: string;
  allowInsecure?: boolean;
  shortId?: string;
  publicKey?: string;
  spiderX?: string;
  dest?: string;
  serverNames?: string[];
  wsSettings?: WsSettings;
  grpcSettings?: GrpcSettings;
  httpSettings?: HttpSettings;
  httpupgradeSettings?: HttpUpgradeSettings;
  xhttpSettings?: XhttpSettings;
  kcpSettings?: {
    headerType: string;
    seed: string;
  };
}

// ──────────────────────────────────────────────
// 15. PORT SHARING
// ──────────────────────────────────────────────

export interface PortShareConfig {
  id: string;
  protocol: Protocol;
  tag: string;
  host?: string;
  path?: string;
  settings: Record<string, any>;
  stream: Record<string, any>;
  enable: boolean;
}

// ──────────────────────────────────────────────
// 16. OUTBOUND CONFIG
// ──────────────────────────────────────────────

export interface OutboundConfig {
  protocol: string;
  tag: string;
  settings: Record<string, any>;
  streamSettings?: StreamConfig;
  mux?: {
    enabled: boolean;
    concurrency: number;
    xudpConcurrency?: number;
    xudpProxyCommand?: string;
  };
  proxySettings?: {
    tag: string;
    transportLayer: boolean;
  };
}

// ──────────────────────────────────────────────
// 17. FULL XRAY CONFIG
// ──────────────────────────────────────────────

export interface XrayConfig {
  log: {
    access: string | 'none';
    error: string;
    loglevel: 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'none';
  };
  stats: Record<string, any>;
  api: {
    tag: string;
    services: string[];
  };
  dns: DnsConfig;
  policy: PolicyConfig;
  routing: RoutingConfig;
  inbounds: any[];
  outbounds: OutboundConfig[];
}

// ──────────────────────────────────────────────
// 18. SING-BOX CONFIG
// ──────────────────────────────────────────────

export interface SingboxConfig {
  log: { level: string; timestamp: boolean };
  dns: any;
  inbounds: any[];
  outbounds: any[];
  route: any;
  experimental?: any;
}

// ──────────────────────────────────────────────
// 19. FULL NODE STATUS
// ──────────────────────────────────────────────

export interface NodeStatus {
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'MAINTENANCE';
  xrayRunning: boolean;
  singboxRunning: boolean;
  naiveRunning: boolean;
  mieruRunning: boolean;
  xrayPid: number | null;
  singboxPid: number | null;
  naivePid: number | null;
  mieruPid: number | null;
  uptime: number;
  version: string;
  cpuUsage: number;
  memUsage: number;
  connections: number;
  xrayConfig?: XrayConfig;
  singboxConfig?: SingboxConfig;
  ports: PortInfo[];
}

export interface PortInfo {
  port: number;
  protocol: string;
  status: 'listening' | 'closed';
  connections: number;
}

// ──────────────────────────────────────────────
// 20. SUBSCRIPTION OUTPUT FORMATS
// ──────────────────────────────────────────────

export interface SubscriptionEntry {
  protocol: string;
  tag: string;
  host: string;
  port: number;
  raw: string;
}

export interface ClashProxy {
  name: string;
  type: string;
  server: string;
  port: number;
  [key: string]: any;
}

export interface SingboxOutbound {
  type: string;
  tag: string;
  server: string;
  server_port: number;
  [key: string]: any;
}

// ──────────────────────────────────────────────
// 21. BILLING TYPES
// ──────────────────────────────────────────────

export type PaymentMethod = 'crypto_pay' | 'stripe' | 'telegram_stars' | 'manual';
export type InvoiceStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
export type OrderStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
export type PlanType = 'USER' | 'RESELLER';
export type SubFormat = 'BASE64' | 'JSON' | 'CLASH' | 'SINGBOX' | 'ORIGINAL';
export type BackupType = 'DATABASE' | 'CONFIG' | 'FULL';
export type BackupStatus = 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';
export type NotificationType = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS' | 'TRAFFIC_LIMIT' | 'SUBSCRIPTION_EXPIRED' | 'NODE_OFFLINE' | 'PAYMENT_RECEIVED';
