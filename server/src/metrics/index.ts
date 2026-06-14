import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

collectDefaultMetrics({ prefix: 'proxpanel_' });

export const httpRequestsTotal = new Counter({
  name: 'proxpanel_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

export const httpRequestDuration = new Histogram({
  name: 'proxpanel_http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

export const activeConnections = new Gauge({
  name: 'proxpanel_active_connections',
  help: 'Active proxy connections',
  labelNames: ['node_id', 'protocol'],
});

export const trafficBytes = new Counter({
  name: 'proxpanel_traffic_bytes_total',
  help: 'Total traffic in bytes',
  labelNames: ['node_id', 'client_id', 'direction', 'protocol'],
});

export const nodeStatus = new Gauge({
  name: 'proxpanel_node_status',
  help: 'Node status (1=online, 0=offline)',
  labelNames: ['node_id', 'node_name'],
});

export const nodeCpuUsage = new Gauge({
  name: 'proxpanel_node_cpu_usage',
  help: 'Node CPU usage percentage',
  labelNames: ['node_id'],
});

export const nodeMemUsage = new Gauge({
  name: 'proxpanel_node_memory_usage',
  help: 'Node memory usage percentage',
  labelNames: ['node_id'],
});

export const clientsTotal = new Gauge({
  name: 'proxpanel_clients_total',
  help: 'Total active clients',
  labelNames: ['reseller_id'],
});

export const subscriptionsActive = new Gauge({
  name: 'proxpanel_subscriptions_active',
  help: 'Active subscriptions',
});

export const revenueTotal = new Counter({
  name: 'proxpanel_revenue_total',
  help: 'Total revenue',
  labelNames: ['currency', 'payment_method'],
});
