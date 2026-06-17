import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, nodesApi } from '@/lib/api';
import { formatBytes, cn } from '@/lib/utils';
import {
  Activity, Server, Users, ArrowUp, ArrowDown,
  AlertTriangle, CheckCircle,
  Zap,
  Radio, Bell
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  CartesianGrid
} from 'recharts';

// ══════════════════════════════════════════════
// System Alerts Feed
// ══════════════════════════════════════════════

interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  time: string;
  core?: string;
  node?: string;
}

function useSystemAlerts(): SystemAlert[] {
  const [alerts] = useState<SystemAlert[]>([
    { id: '1', type: 'success', title: 'Node Online', message: 'Frankfurt node connected successfully', time: '2m ago', node: 'DE-Frankfurt' },
    { id: '2', type: 'warning', title: 'High CPU', message: 'Tokyo node CPU usage at 87%', time: '5m ago', node: 'JP-Tokyo' },
    { id: '3', type: 'error', title: 'Hysteria2 Failed', message: 'Port 8443 already in use on US-East', time: '12m ago', core: 'singbox', node: 'US-East' },
    { id: '4', type: 'info', title: 'Config Pushed', message: 'New inbound config pushed to 3 nodes', time: '15m ago' },
    { id: '5', type: 'success', title: 'Xray Restarted', message: 'Auto-restart successful on SG-Node', time: '22m ago', core: 'xray', node: 'SG-Node' },
  ]);

  return alerts;
}

function AlertIcon({ type }: { type: SystemAlert['type'] }) {
  const map = {
    error: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    info: { icon: Bell, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    success: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  };
  const conf = map[type];
  return (
    <div className={cn("p-1.5 rounded-lg", conf.bg)}>
      <conf.icon size={12} className={conf.color} />
    </div>
  );
}

function AlertsFeed({ alerts }: { alerts: SystemAlert[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-amber-400" />
          <h3 className="text-sm font-semibold text-white">System Alerts</h3>
        </div>
        <span className="text-[10px] text-fg-muted">{alerts.length} recent</span>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {alerts.map(alert => (
          <div key={alert.id} className="flex items-start gap-2.5 py-2 px-2 rounded-lg hover:bg-bg-raised transition-colors">
            <AlertIcon type={alert.type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-fg">{alert.title}</span>
                {alert.core && (
                  <span className="px-1 py-0.5 rounded text-[8px] font-medium bg-bg-raised text-fg-muted">{alert.core}</span>
                )}
              </div>
              <p className="text-[10px] text-fg-subtle mt-0.5 truncate">{alert.message}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-fg-muted">{alert.time}</span>
                {alert.node && (
                  <span className="flex items-center gap-0.5 text-[9px] text-fg-muted">
                    <Server size={8} /> {alert.node}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Bandwidth Card
// ══════════════════════════════════════════════

function BandwidthCard({ overview }: { overview: any }) {
  const todayUp = Number(overview?.traffic?.today?.upload || 0);
  const todayDown = Number(overview?.traffic?.today?.download || 0);
  const monthUp = Number(overview?.traffic?.month?.upload || 0);
  const monthDown = Number(overview?.traffic?.month?.download || 0);

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={14} className="text-[hsl(var(--accent))]" />
        <h3 className="text-sm font-semibold text-white">Cluster Bandwidth</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] text-fg-subtle uppercase tracking-wider mb-1">Today</div>
          <div className="text-lg font-bold text-white">{formatBytes(todayUp + todayDown)}</div>
          <div className="flex items-center gap-3 mt-1 text-[10px]">
            <span className="flex items-center gap-1 text-violet-400"><ArrowUp size={10} />{formatBytes(todayUp)}</span>
            <span className="flex items-center gap-1 text-cyan-400"><ArrowDown size={10} />{formatBytes(todayDown)}</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-fg-subtle uppercase tracking-wider mb-1">This Month</div>
          <div className="text-lg font-bold text-white">{formatBytes(monthUp + monthDown)}</div>
          <div className="flex items-center gap-3 mt-1 text-[10px]">
            <span className="flex items-center gap-1 text-violet-400"><ArrowUp size={10} />{formatBytes(monthUp)}</span>
            <span className="flex items-center gap-1 text-cyan-400"><ArrowDown size={10} />{formatBytes(monthDown)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Top Loaded Nodes
// ══════════════════════════════════════════════

function TopNodesCard({ nodes }: { nodes: any[] }) {
  const sorted = [...nodes]
    .filter(n => n.status === 'ONLINE')
    .sort((a, b) => (b.cpuUsage || 0) - (a.cpuUsage || 0))
    .slice(0, 3);

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Server size={14} className="text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Top Loaded Nodes</h3>
      </div>
      <div className="space-y-3">
        {sorted.map((node, i) => (
          <div key={node.id} className="flex items-center gap-3">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
              i === 0 ? "bg-amber-500/20 text-amber-400" :
              i === 1 ? "bg-bg-sunken text-fg-muted" :
              "bg-orange-500/10 text-orange-400"
            )}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-fg font-medium">{node.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-bg-raised rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all",
                    (node.cpuUsage || 0) > 80 ? "bg-red-500" :
                    (node.cpuUsage || 0) > 50 ? "bg-amber-500" : "bg-emerald-500"
                  )} style={{ width: `${Math.min(node.cpuUsage || 0, 100)}%` }} />
                </div>
                <span className="text-[10px] text-fg-muted w-10 text-right">{(node.cpuUsage || 0).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="text-xs text-fg-muted text-center py-4">No online nodes</div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Cluster Summary Strip
// ══════════════════════════════════════════════

function ClusterStrip({ overview, nodes }: { overview: any; nodes: any[] }) {
  const online = nodes?.filter(n => n.status === 'ONLINE').length || 0;
  const total = nodes?.length || 0;

  const stats = [
    { label: 'Total Clients', value: overview?.clients?.total || 0, icon: Users, color: 'text-blue-400' },
    { label: 'Expiring Today', value: overview?.expiringToday || 0, icon: Zap, color: 'text-[hsl(var(--accent))]' },
    { label: 'Nodes Online', value: `${online}/${total}`, icon: Server, color: 'text-emerald-400' },
    { label: 'Inbounds', value: overview?.inbounds?.total || 0, icon: Radio, color: 'text-cyan-400' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label} className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <s.icon size={18} className={s.color} />
          <div>
            <div className="text-[10px] text-fg-subtle uppercase tracking-wider">{s.label}</div>
            <div className="text-lg font-bold text-white">{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// Custom Chart Tooltip
// ══════════════════════════════════════════════

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[10px] text-fg-muted mb-1">{label ? new Date(label).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-[11px]">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-fg-muted capitalize">{p.name}:</span>
          <span className="text-fg font-medium">{formatBytes(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// Main System Dashboard
// ══════════════════════════════════════════════

export function SystemDashboard() {
  const alerts = useSystemAlerts();

  const { data: overview } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardApi.getOverview().then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: trafficChart } = useQuery({
    queryKey: ['dashboard-traffic'],
    queryFn: () => dashboardApi.getTrafficChart({ days: 7 }).then(r => r.data),
  });

  const { data: nodes } = useQuery({
    queryKey: ['nodes-list'],
    queryFn: () => nodesApi.getAll().then(r => r.data),
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-4">
      {/* Cluster Summary */}
      <ClusterStrip overview={overview} nodes={nodes || []} />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Traffic Chart (2 cols) */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Cluster Traffic</h2>
              <p className="text-[10px] text-fg-subtle">Aggregate bandwidth across all nodes</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" /> Upload</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500" /> Download</span>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficChart || []}>
                <defs>
                  <linearGradient id="sysUpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="sysDownGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="day" stroke="#374151" tick={{ fontSize: 10 }} tickLine={false}
                  tickFormatter={v => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                <YAxis stroke="#374151" tick={{ fontSize: 10 }} tickLine={false}
                  tickFormatter={v => formatBytes(v, 0)} width={55} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="upload" stroke="#8b5cf6" fill="url(#sysUpGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="download" stroke="#06b6d4" fill="url(#sysDownGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bandwidth Stats */}
        <BandwidthCard overview={overview} />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Nodes */}
        <TopNodesCard nodes={nodes || []} />

        {/* Alerts */}
        <div className="lg:col-span-2">
          <AlertsFeed alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
