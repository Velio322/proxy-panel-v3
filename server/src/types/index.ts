import { Request } from 'express';

export interface AuthUser {
  id: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'RESELLER' | 'OPERATOR';
  resellerId?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface NodeStatusResponse {
  nodeId: string;
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
  cpuUsage?: number;
  memUsage?: number;
  connections?: number;
}

export interface NodeConfigPayload {
  inbounds: InboundConfig[];
  routing?: any;
}

export interface InboundConfig {
  id: string;
  protocol: string;
  tag: string;
  port: number;
  listen?: string;
  settings: any;
  stream?: any;
  routing?: any;
  sniffing?: boolean;
  portShares?: PortShareConfig[];
}

export interface PortShareConfig {
  protocol: string;
  tag: string;
  host?: string;
  path?: string;
  settings: any;
  stream: any;
}

export interface TrafficSnapshot {
  clientId: string;
  nodeId: string;
  upload: number;
  download: number;
  protocol?: string;
  inboundTag?: string;
}

export interface SubscriptionConfig {
  uuid: string;
  address: string;
  port: number;
  protocol: string;
  settings: any;
  stream?: any;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface AuditAction {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ip?: string;
  userAgent?: string;
}
