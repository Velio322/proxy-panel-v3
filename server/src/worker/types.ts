export interface WorkerConfig {
  nodeSecret: string;
  masterUrl: string;
  workerPort: number;
  configDir: string;
  xrayBin: string;
  singboxBin: string;
  naiveBin: string;
  mieruBin: string;
  pollInterval: number;
  metricsPort: number;
  haproxyEnabled: boolean;
}

export interface InboundConfig {
  id: string;
  protocol: Protocol;
  tag: string;
  port: number;
  listen: string;
  settings: Record<string, any>;
  stream: Record<string, any>;
  routing: Record<string, any>;
  sniffing: Record<string, any>;
  remark?: string;
  enable: boolean;
  portShares: PortShareConfig[];
}

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

export type Protocol = 'VLESS' | 'VMESS' | 'TROJAN' | 'SHADOWSOCKS' | 'HYSTERIA2' | 'NAIVEPROXY' | 'MIERU' | 'TUIC';

export interface CoreProcess {
  name: string;
  process: any; // ChildProcess
  pid: number | null;
  running: boolean;
  startedAt: Date | null;
  configPath: string;
}

export interface NodeStatus {
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
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
}

export interface TrafficSnapshot {
  upload: number;
  download: number;
  perUser: Record<string, { upload: number; download: number }>;
}

export interface MasterPayload {
  inbounds: InboundConfig[];
  routing?: any;
  timestamp: number;
}

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
  protocol?: string[];
  outboundTag: string;
  balancerTag?: string;
  negate?: boolean;
  email?: string;
  user?: string[];
  attrs?: string;
  network?: 'tcp' | 'udp' | 'tcp,udp';
}

export interface XrayConfig {
  log: Record<string, any>;
  stats: Record<string, any>;
  api: Record<string, any>;
  dns: Record<string, any>;
  policy: Record<string, any>;
  routing: Record<string, any>;
  inbounds: any[];
  outbounds: any[];
}

export interface SingboxConfig {
  log: { level: string; timestamp: boolean };
  dns: any;
  inbounds: any[];
  outbounds: any[];
  route: any;
  experimental?: any;
}
