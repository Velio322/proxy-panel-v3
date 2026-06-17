import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ──── Types ────

export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'RESELLER' | 'OPERATOR';
  resellerId?: string;
  language?: string;
  banned?: boolean;
  lastLoginAt?: string;
  lastLoginIp?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  uuid: string;
  username: string;
  email?: string;
  trafficLimit: number;
  usedTraffic: number;
  uploadTraffic: number;
  downloadTraffic: number;
  expireAt?: string;
  banned: boolean;
  note?: string;
  telegramId?: number;
  subToken: string;
  protocols?: string[];
  lastActiveAt?: string;
  createdAt: string;
  settings?: { subId: string; subPath: string };
  reseller?: { id: string; name: string };
}

export interface Node {
  id: string;
  name: string;
  host: string;
  port: number;
  apiPort: number;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'MAINTENANCE';
  country?: string;
  city?: string;
  isp?: string;
  lastCheckAt?: string;
  lastPingMs?: number;
  version?: string;
  cpuUsage?: number;
  memUsage?: number;
  netUpload: number;
  netDownload: number;
  tags?: string[];
  active: boolean;
  inbounds?: Inbound[];
  _count?: { inbounds: number };
  createdAt: string;
}

export interface Inbound {
  id: string;
  nodeId: string;
  protocol: string;
  tag: string;
  port: number;
  listen: string;
  settings: Record<string, any>;
  stream: Record<string, any>;
  routing?: Record<string, any>;
  sniffing: boolean;
  remark?: string;
  enable: boolean;
  portShares?: PortShare[];
  node?: { id: string; name: string; host: string; status: string };
}

export interface PortShare {
  id: string;
  protocol: string;
  tag: string;
  host?: string;
  path?: string;
  settings: Record<string, any>;
  stream: Record<string, any>;
  enable: boolean;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  type: 'USER' | 'RESELLER';
  price: number;
  currency: string;
  duration: number;
  trafficLimit: number;
  maxClients?: number;
  maxSpeed?: number;
  protocols?: string[];
  active: boolean;
  _count?: { subscriptions: number };
}

export interface DashboardOverview {
  clients: { total: number; active: number; banned: number };
  nodes: { total: number; online: number; offline: number };
  inbounds: { total: number };
  expiringToday: number;
  traffic: {
    today: { upload: number; download: number };
    month: { upload: number; download: number };
  };
}

export interface TrafficLog {
  day?: string;
  upload: number;
  download: number;
}

export interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  user?: { id: string; username: string; role: string };
}

export interface RoutingRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  type: 'field' | 'logical';
  domain?: string[];
  ip?: string[];
  port?: string;
  sourcePort?: string;
  source?: string[];
  protocol?: string[];
  inboundTag?: string[];
  outboundTag: string;
  balancerTag?: string;
  subRules?: any[];
  nodeScope?: string;
  createdAt: string;
  updatedAt: string;
}

// ──── API Methods ────

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { username, password }),
  getMe: () => api.get<User>('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const dashboardApi = {
  getOverview: () => api.get<DashboardOverview>('/dashboard/overview'),
  getTrafficChart: (params?: { days?: number; nodeId?: string; clientId?: string }) =>
    api.get<TrafficLog[]>('/dashboard/traffic-chart', { params }),
  getTopClients: (params?: { days?: number; limit?: number }) =>
    api.get('/dashboard/top-clients', { params }),
  getRecentAudit: (params?: { limit?: number }) =>
    api.get<AuditLog[]>('/dashboard/recent-audit', { params }),
};

export const clientsApi = {
  getAll: (params?: Record<string, any>) =>
    api.get<{ data: Client[]; total: number; page: number; pages: number }>('/clients', { params }),
  getById: (id: string) => api.get<Client>(`/clients/${id}`),
  create: (data: any) => api.post<Client>('/clients', data),
  update: (id: string, data: any) => api.put<Client>(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`),
  resetTraffic: (id: string) => api.post(`/clients/${id}/reset-traffic`),
  toggleBan: (id: string) => api.post(`/clients/${id}/toggle-ban`),
  getStats: (id: string, days?: number) =>
    api.get(`/clients/${id}/stats`, { params: { days } }),
  getTrafficDaily: (id: string, days?: number) =>
    api.get(`/clients/${id}/traffic-daily`, { params: { days } }),
};

export const nodesApi = {
  getAll: (params?: Record<string, any>) => api.get<Node[]>('/nodes', { params }),
  getById: (id: string) => api.get<Node>(`/nodes/${id}`),
  create: (data: any) => api.post<Node>('/nodes', data),
  update: (id: string, data: any) => api.put<Node>(`/nodes/${id}`, data),
  delete: (id: string) => api.delete(`/nodes/${id}`),
  check: (id: string) => api.post(`/nodes/${id}/check`),
  pushConfig: (id: string) => api.post(`/nodes/${id}/push-config`),
  restart: (id: string) => api.post(`/nodes/${id}/restart`),
  stop: (id: string) => api.post(`/nodes/${id}/stop`),
  getMetrics: (id: string) => api.get(`/nodes/${id}/metrics`),
  getInbounds: (id: string) => api.get<Inbound[]>(`/nodes/${id}/inbounds`),
  getStats: (id: string, days?: number) =>
    api.get(`/nodes/${id}/stats`, { params: { days } }),
};

export const inboundsApi = {
  getAll: (params?: Record<string, any>) => api.get<Inbound[]>('/inbounds', { params }),
  getById: (id: string) => api.get<Inbound>(`/inbounds/${id}`),
  create: (data: any) => api.post<Inbound>('/inbounds', data),
  update: (id: string, data: any) => api.put<Inbound>(`/inbounds/${id}`, data),
  delete: (id: string) => api.delete(`/inbounds/${id}`),
  toggle: (id: string) => api.post(`/inbounds/${id}/toggle`),
  addPortShare: (inboundId: string, data: any) =>
    api.post(`/inbounds/${inboundId}/port-share`, data),
  deletePortShare: (inboundId: string, psId: string) =>
    api.delete(`/inbounds/${inboundId}/port-share/${psId}`),
};

export const usersApi = {
  getAll: (params?: Record<string, any>) =>
    api.get<{ data: User[]; total: number }>('/users', { params }),
  getById: (id: string) => api.get<User>(`/users/${id}`),
  create: (data: any) => api.post<User>('/users', data),
  update: (id: string, data: any) => api.put<User>(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  resetPassword: (id: string) => api.post<{ password: string }>(`/users/${id}/reset-password`),
  toggleBan: (id: string) => api.post(`/users/${id}/toggle-ban`),
};

export const plansApi = {
  getAll: (params?: Record<string, any>) => api.get<Plan[]>('/plans', { params }),
  getById: (id: string) => api.get<Plan>(`/plans/${id}`),
  create: (data: any) => api.post<Plan>('/plans', data),
  update: (id: string, data: any) => api.put<Plan>(`/plans/${id}`, data),
  delete: (id: string) => api.delete(`/plans/${id}`),
};

export const auditApi = {
  getAll: (params?: Record<string, any>) =>
    api.get<{ logs: AuditLog[]; total: number }>('/audit', { params }),
};

export const routingApi = {
  getAll: (params?: Record<string, any>) => api.get<RoutingRule[]>('/routing', { params }),
  create: (data: Partial<RoutingRule>) => api.post<RoutingRule>('/routing', data),
  update: (id: string, data: Partial<RoutingRule>) => api.put<RoutingRule>(`/routing/${id}`, data),
  delete: (id: string) => api.delete(`/routing/${id}`),
  toggle: (id: string) => api.post(`/routing/${id}/toggle`),
  reorder: (data: { rules: Array<{ id: string; priority: number }> }) =>
    api.post('/routing/reorder', data),
  getPresets: () => api.get('/routing/presets/list'),
};


export const settingsApi = {
  getAll: () => api.get<Record<string, any>>('/settings'),
  saveAll: (data: Record<string, any>) => api.put('/settings', data),
  get: (key: string) => api.get(`/settings/${key}`),
  set: (key: string, value: any) => api.put(`/settings/${key}`, { value }),
};

export const subscriptionsApi = {
  getAll: (params?: Record<string, any>) =>
    api.get<{ data: any[]; total: number }>('/subscriptions', { params }),
  create: (data: any) => api.post('/subscriptions', data),
  update: (id: string, data: any) => api.put(`/subscriptions/${id}`, data),
  cancel: (id: string) => api.post(`/subscriptions/${id}/cancel`),
};

export const resellersApi = {
  getAll: (params?: Record<string, any>) => api.get<any[]>('/resellers', { params }),
  getById: (id: string) => api.get(`/resellers/${id}`),
  create: (data: any) => api.post('/resellers', data),
  update: (id: string, data: any) => api.put(`/resellers/${id}`, data),
  delete: (id: string) => api.delete(`/resellers/${id}`),
};

export const backupApi = {
  run: () => api.post('/backup/run'),
  getLogs: () => api.get('/backup/logs'),
};

export default api;

