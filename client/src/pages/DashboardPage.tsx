import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import {
  Users, Server, Wifi, WifiOff, ArrowUp, ArrowDown,
  TrendingUp, Clock, AlertTriangle, Activity
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';

export function DashboardPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardApi.getOverview().then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: trafficChart } = useQuery({
    queryKey: ['dashboard-traffic'],
    queryFn: () => dashboardApi.getTrafficChart({ days: 7 }).then((r) => r.data),
  });

  const { data: topClients } = useQuery({
    queryKey: ['dashboard-top-clients'],
    queryFn: () => dashboardApi.getTopClients({ days: 7, limit: 5 }).then((r) => r.data),
  });

  const { data: recentAudit } = useQuery({
    queryKey: ['dashboard-recent-audit'],
    queryFn: () => dashboardApi.getRecentAudit({ limit: 8 }).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  const stats = overview
    ? [
        { label: 'Total Clients', value: overview.clients.total, sub: `${overview.clients.active} active`, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Nodes Online', value: `${overview.nodes.online}/${overview.nodes.total}`, sub: `${overview.inbounds.total} inbounds`, icon: Server, color: 'text-green-400', bg: 'bg-green-500/10' },
        { label: 'Today Traffic', value: formatBytes(Number(overview.traffic.today.upload) + Number(overview.traffic.today.download)), sub: `↑${formatBytes(Number(overview.traffic.today.upload))} ↓${formatBytes(Number(overview.traffic.today.download))}`, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        { label: 'Month Traffic', value: formatBytes(Number(overview.traffic.month.upload) + Number(overview.traffic.month.download)), sub: `${overview.subscriptions.active} subscriptions`, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">System overview and real-time stats</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-400">{stat.label}</span>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon size={18} className={stat.color} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Traffic Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Traffic (7 days)</h2>
            <p className="text-xs text-gray-500 mt-0.5">Upload and download per day</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              Upload
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              Download
            </span>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trafficChart || []}>
              <defs>
                <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="downloadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="day"
                stroke="#6b7280"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => formatBytes(v, 0)}
              />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v) => new Date(v).toLocaleDateString()}
                formatter={(v: any, name: string) => [formatBytes(v), name === 'upload' ? 'Upload' : 'Download']}
              />
              <Area type="monotone" dataKey="upload" stroke="#8b5cf6" fill="url(#uploadGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="download" stroke="#06b6d4" fill="url(#downloadGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row: Top Clients + Recent Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clients */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Top Clients (7 days)</h2>
          <div className="space-y-3">
            {topClients && topClients.length > 0 ? (
              topClients.map((tc: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-400">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">
                      {tc.client?.username || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500">
                      ↑ {formatBytes(Number(tc._sum?.upload || 0))} · ↓ {formatBytes(Number(tc._sum?.download || 0))}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-300">
                    {formatBytes(Number(tc._sum?.upload || 0) + Number(tc._sum?.download || 0))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 text-center py-8">No data yet</div>
            )}
          </div>
        </div>

        {/* Recent Audit */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentAudit && recentAudit.length > 0 ? (
              recentAudit.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-md ${
                    log.action === 'LOGIN' ? 'bg-green-500/10 text-green-400' :
                    log.action === 'DELETE' ? 'bg-red-500/10 text-red-400' :
                    log.action === 'CREATE' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {log.action === 'LOGIN' ? <Wifi size={12} /> :
                     log.action === 'DELETE' ? <AlertTriangle size={12} /> :
                     <Activity size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-300">
                      <span className="font-medium text-gray-200">{log.user?.username || 'System'}</span>
                      {' '}
                      <span className="text-gray-500">{log.action.toLowerCase()}</span>
                      {' '}
                      <span className="text-gray-400">{log.resource}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 text-center py-8">No activity yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
