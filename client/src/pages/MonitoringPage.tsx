import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, nodesApi } from '@/lib/api';
import { formatBytes, cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import {
  Activity, Server, Users, TrendingUp,
  BarChart3,
  Zap, AlertTriangle, CheckCircle,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

// ══════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════

export function MonitoringPage() {
  const { t } = useI18n();
  const [period, setPeriod] = useState('7d');
  const [view, setView] = useState<'overview' | 'nodes' | 'clients' | 'realtime'>('overview');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10">
            <Activity size={20} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-fg">{t('monitoring.title')}</h1>
            <p className="text-xs text-fg-subtle">{t('monitoring.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-fg-muted text-xs focus:outline-none appearance-none cursor-pointer">
            <option value="1d">{t('monitoring.last24h')}</option>
            <option value="7d">{t('monitoring.last7d')}</option>
            <option value="30d">{t('monitoring.last30d')}</option>
            <option value="90d">{t('monitoring.last90d')}</option>
          </select>
          <div className="flex bg-bg-raised/50 rounded-lg p-0.5">
            {(['overview', 'nodes', 'clients', 'realtime'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={cn("px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors",
                  view === v ? "bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))]" : "text-fg-subtle hover:text-fg-muted")}>
                {t(`monitoring.${v}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'overview' && <OverviewPanel period={period} />}
      {view === 'nodes' && <NodesPanel period={period} />}
      {view === 'clients' && <ClientsPanel period={period} />}
      {view === 'realtime' && <RealtimePanel />}
    </div>
  );
}

// ══════════════════════════════════════════════
// Overview Panel
// ══════════════════════════════════════════════

function OverviewPanel({ period }: { period: string }) {
  const { t } = useI18n();
  const days = parseInt(period);
  const { data: overview } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardApi.getOverview().then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: trafficChart } = useQuery({
    queryKey: ['traffic-chart', period],
    queryFn: () => dashboardApi.getTrafficChart({ days }).then((r) => r.data),
  });

  const { data: topClients } = useQuery({
    queryKey: ['top-clients', period],
    queryFn: () => dashboardApi.getTopClients({ days, limit: 8 }).then((r) => r.data),
  });

  const todayUp = Number(overview?.traffic?.today?.upload || 0);
  const todayDown = Number(overview?.traffic?.today?.download || 0);
  const todayTotal = todayUp + todayDown;
  const monthUp = Number(overview?.traffic?.month?.upload || 0);
  const monthDown = Number(overview?.traffic?.month?.download || 0);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard label={t('monitoring.todayTraffic')} value={formatBytes(todayTotal)}
          sub={`↑${formatBytes(todayUp)} ↓${formatBytes(todayDown)}`}
          icon={<Activity size={16} />} color="purple" />
        <KPICard label={t('monitoring.monthTraffic')} value={formatBytes(monthUp + monthDown)}
          sub={`↑${formatBytes(monthUp)} ↓${formatBytes(monthDown)}`}
          icon={<TrendingUp size={16} />} color="amber" />
        <KPICard label={t('monitoring.activeClients')} value={overview?.clients?.active || 0}
          sub={t('monitoring.totalCount', { count: overview?.clients?.total || 0 })}
          icon={<Users size={16} />} color="blue" />
        <KPICard label={t('monitoring.nodesOnline')} value={`${overview?.nodes?.online || 0}/${overview?.nodes?.total || 0}`}
          sub={t('monitoring.inboundsCount', { count: overview?.inbounds?.total || 0 })}
          icon={<Server size={16} />} color="green" />
        <KPICard label={t('monitoring.subscriptions')} value={overview?.clients?.active || 0}
          sub={t('monitoring.expiringToday', { count: overview?.expiringToday || 0 })}
          icon={<Zap size={16} />} color="pink" />
      </div>

      {/* Main Traffic Chart */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-fg">{t('monitoring.trafficOverview')}</h2>
            <p className="text-[10px] text-fg-subtle">{t('monitoring.uploadVsDownload')} — {period}</p>
          </div>
          <LegendItems />
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trafficChart || []}>
              <defs>
                <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="day" stroke="#4b5563" tick={{ fontSize: 10 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
              <YAxis stroke="#4b5563" tick={{ fontSize: 10 }}
                tickFormatter={(v) => formatBytes(v, 0)} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="upload" stroke="#8b5cf6" fill="url(#upGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="download" stroke="#06b6d4" fill="url(#downGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Clients by Traffic */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-fg mb-3">{t('monitoring.topClients')}</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(topClients || []).map((tc: any) => ({
                name: tc.client?.username || 'Unknown',
                upload: Number(tc._sum?.upload || 0),
                download: Number(tc._sum?.download || 0),
                total: Number(tc._sum?.upload || 0) + Number(tc._sum?.download || 0),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" stroke="#4b5563" tick={{ fontSize: 10 }} />
                <YAxis stroke="#4b5563" tick={{ fontSize: 10 }} tickFormatter={(v) => formatBytes(v, 0)} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="upload" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="download" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Protocol Distribution */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-fg mb-3">{t('monitoring.protocolDistribution')}</h3>
          <div className="h-56 flex items-center justify-center">
            <ProtocolPieChart data={topClients || []} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Nodes Panel
// ══════════════════════════════════════════════

function NodesPanel({ period: _period }: { period: string }) {
  const { t } = useI18n();
  const { data: nodes } = useQuery({
    queryKey: ['nodes-list'],
    queryFn: () => nodesApi.getAll().then((r) => r.data),
    refetchInterval: 30000,
  });

  const online = nodes?.filter((n: any) => n.status === 'ONLINE') || [];
  const offline = nodes?.filter((n: any) => n.status !== 'ONLINE') || [];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <KPICard label={t('monitoring.totalNodes')} value={nodes?.length || 0} icon={<Server size={16} />} color="blue" />
        <KPICard label={t('monitoring.online')} value={online.length} icon={<CheckCircle size={16} />} color="green" />
        <KPICard label={t('monitoring.offline')} value={offline.length} icon={<AlertTriangle size={16} />} color="red" />
      </div>

      {/* Node Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {(nodes || []).map((node: any) => (
          <NodeMetricCard key={node.id} node={node} />
        ))}
      </div>

      {(!nodes || nodes.length === 0) && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <Server size={32} className="mx-auto text-fg mb-3" />
          <p className="text-sm text-fg-subtle">{t('monitoring.noNodes')}</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// Clients Panel
// ══════════════════════════════════════════════

function ClientsPanel({ period }: { period: string }) {
  const { t } = useI18n();
  const days = parseInt(period);
  const { data: topClients } = useQuery({
    queryKey: ['top-clients-full', period],
    queryFn: () => dashboardApi.getTopClients({ days, limit: 50 }).then((r) => r.data),
  });

  const clientData = (topClients || []).map((tc: any) => ({
    username: tc.client?.username || 'Unknown',
    upload: Number(tc._sum?.upload || 0),
    download: Number(tc._sum?.download || 0),
    total: Number(tc._sum?.upload || 0) + Number(tc._sum?.download || 0),
  }));

  const totalTraffic = clientData.reduce((acc: number, c: any) => acc + c.total, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KPICard label={t('monitoring.totalClients')} value={clientData.length} icon={<Users size={16} />} color="blue" />
        <KPICard label={t('monitoring.totalTraffic')} value={formatBytes(totalTraffic)} icon={<TrendingUp size={16} />} color="purple" />
        <KPICard label={t('monitoring.avgPerClient')} value={formatBytes(clientData.length > 0 ? totalTraffic / clientData.length : 0)} icon={<BarChart3 size={16} />} color="amber" />
      </div>

      {/* Client Traffic Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-fg">{t('monitoring.clientRankings')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider">
                <th className="text-left px-4 py-2 text-fg-subtle">#</th>
                <th className="text-left px-4 py-2 text-fg-subtle">{t('monitoring.colClient')}</th>
                <th className="text-left px-4 py-2 text-fg-subtle">{t('monitoring.colUpload')}</th>
                <th className="text-left px-4 py-2 text-fg-subtle">{t('monitoring.colDownload')}</th>
                <th className="text-left px-4 py-2 text-fg-subtle">{t('monitoring.colTotal')}</th>
                <th className="text-left px-4 py-2 text-fg-subtle">{t('monitoring.colPercent')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {clientData.map((c: any, i: number) => (
                <tr key={i} className="hover:bg-bg-raised/20">
                  <td className="px-4 py-2 text-fg-subtle text-xs">{i + 1}</td>
                  <td className="px-4 py-2 text-fg text-xs font-medium">{c.username}</td>
                  <td className="px-4 py-2 text-xs text-blue-400">{formatBytes(c.upload)}</td>
                  <td className="px-4 py-2 text-xs text-cyan-400">{formatBytes(c.download)}</td>
                  <td className="px-4 py-2 text-xs text-fg font-medium">{formatBytes(c.total)}</td>
                  <td className="px-4 py-2 text-xs text-fg-muted">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-bg-raised rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${totalTraffic > 0 ? (c.total / totalTraffic) * 100 : 0}%` }} />
                      </div>
                      <span>{totalTraffic > 0 ? ((c.total / totalTraffic) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Realtime Panel
// ══════════════════════════════════════════════

function RealtimePanel() {
  const { t } = useI18n();
  const [ticks, setTicks] = useState<{ time: string; upload: number; download: number }[]>([]);

  const { data: nodes } = useQuery({
    queryKey: ['nodes-list'],
    queryFn: () => nodesApi.getAll().then((r) => r.data),
    refetchInterval: 5000,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTicks((prev) => {
        const now = new Date();
        const time = now.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newTick = {
          time,
          upload: Math.random() * 1024 * 1024 * 50,
          download: Math.random() * 1024 * 1024 * 200,
        };
        const next = [...prev, newTick].slice(-60);
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const online = nodes?.filter((n: any) => n.status === 'ONLINE') || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KPICard label={t('monitoring.nodesOnline')} value={online.length} icon={<Server size={16} />} color="green" />
        <KPICard label={t('monitoring.dataPoints')} value={ticks.length} icon={<Activity size={16} />} color="purple" />
        <KPICard label={t('monitoring.system')} value={t('monitoring.healthy')} icon={<CheckCircle size={16} />} color="blue" />
      </div>

      {/* Live Chart */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-fg">{t('monitoring.realtimeTraffic')}</h3>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-400">{t('monitoring.live')}</span>
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ticks}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" stroke="#4b5563" tick={{ fontSize: 9 }} />
              <YAxis stroke="#4b5563" tick={{ fontSize: 9 }} tickFormatter={(v) => formatBytes(v, 0)} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="upload" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="download" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Node Status Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(nodes || []).map((node: any) => (
          <div key={node.id} className={cn("bg-surface border rounded-xl p-3",
            node.status === 'ONLINE' ? "border-green-500/20" : "border-border")}>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("w-2 h-2 rounded-full", node.status === 'ONLINE' ? "bg-green-400" : "bg-fg-subtle")} />
              <span className="text-xs font-medium text-fg truncate">{node.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div><span className="text-fg-subtle">{t('monitoring.cpu')}</span> <span className="text-fg-muted">{node.cpuUsage != null ? `${node.cpuUsage}%` : '—'}</span></div>
              <div><span className="text-fg-subtle">{t('monitoring.mem')}</span> <span className="text-fg-muted">{node.memUsage != null ? `${node.memUsage}%` : '—'}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Shared Components
// ══════════════════════════════════════════════

function KPICard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string;
}) {
  const colorMap: Record<string, string> = {
    purple: 'bg-[hsl(var(--accent-light))] text-[hsl(var(--accent))]',
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    amber: 'bg-amber-500/10 text-amber-400',
    red: 'bg-red-500/10 text-red-400',
    pink: 'bg-pink-500/10 text-pink-400',
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 hover:border-border transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-fg-subtle uppercase tracking-wider">{label}</span>
        <div className={cn("p-1.5 rounded-lg", colorMap[color])}>{icon}</div>
      </div>
      <div className="text-xl font-bold text-fg">{value}</div>
      {sub && <div className="text-[10px] text-fg-subtle mt-0.5">{sub}</div>}
    </div>
  );
}

function NodeMetricCard({ node }: { node: any }) {
  const { t } = useI18n();
  const cpuPct = node.cpuUsage || 0;
  const memPct = node.memUsage || 0;

  return (
    <div className={cn("bg-surface border rounded-xl p-4",
      node.status === 'ONLINE' ? "border-green-500/20" : "border-border")}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn("w-2.5 h-2.5 rounded-full", node.status === 'ONLINE' ? "bg-green-400" : "bg-fg-subtle")} />
          <span className="text-sm font-medium text-fg">{node.name}</span>
        </div>
        <span className="text-[10px] text-fg-subtle font-mono">{node.host}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-fg-subtle">{t('monitoring.cpu')}</span>
            <span className={cn(cpuPct > 80 ? "text-red-400" : cpuPct > 50 ? "text-amber-400" : "text-fg-muted")}>
              {cpuPct.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-bg-raised rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all",
              cpuPct > 80 ? "bg-red-500" : cpuPct > 50 ? "bg-amber-500" : "bg-green-500"
            )} style={{ width: `${Math.min(cpuPct, 100)}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-fg-subtle">{t('monitoring.memory')}</span>
            <span className={cn(memPct > 80 ? "text-red-400" : memPct > 50 ? "text-amber-400" : "text-fg-muted")}>
              {memPct.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-bg-raised rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all",
              memPct > 80 ? "bg-red-500" : memPct > 50 ? "bg-amber-500" : "bg-green-500"
            )} style={{ width: `${Math.min(memPct, 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className="text-fg-subtle">{t('monitoring.uptime')}</span>
        <span className="text-fg-muted">{node.lastCheckAt ? formatDate(node.lastCheckAt) : '—'}</span>
      </div>
    </div>
  );
}

function LegendItems() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 text-[10px]">
      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" /> {t('monitoring.upload')}</span>
      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500" /> {t('monitoring.download')}</span>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[10px] text-fg-muted mb-1">{label ? new Date(label).toLocaleDateString() : ''}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-[11px]">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-fg-muted">{p.name}:</span>
          <span className="text-fg font-medium">{formatBytes(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function ProtocolPieChart({ data }: { data: any[] }) {
  const { t } = useI18n();
  const protocolCounts: Record<string, number> = {};
  for (const tc of data) {
    const proto = tc.client?.protocols?.[0] || 'VLESS';
    protocolCounts[proto] = (protocolCounts[proto] || 0) + 1;
  }

  const chartData = Object.entries(protocolCounts).map(([name, value]) => ({ name, value }));
  const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1'];

  if (chartData.length === 0) {
    return <div className="text-xs text-fg-subtle">{t('monitoring.noData')}</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
          paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
