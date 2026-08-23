import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, nodesApi } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { Users, Server, Activity, TrendingUp, ArrowUpRight, Clock } from 'lucide-react';
import { KPICard, KPISkeleton } from './dashboard/components/KPICard';
import { SystemHealthCard } from './dashboard/components/SystemHealthCard';
import { QuickActionsPanel } from './dashboard/components/QuickActionsPanel';
import { TrafficChart } from './dashboard/components/TrafficChart';

const ACTION_COLORS: Record<string, string> = {
  LOGIN:  '#10b981',
  LOGOUT: '#64748b',
  CREATE: '#6366f1',
  UPDATE: '#f59e0b',
  DELETE: '#ef4444',
};

export function DashboardPage() {
  const { t } = useI18n();
  const [trafficPeriod, setTrafficPeriod] = useState(7);

  const { data: overview, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardApi.getOverview().then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: trafficChart } = useQuery({
    queryKey: ['dashboard-traffic', trafficPeriod],
    queryFn: () => dashboardApi.getTrafficChart({ days: trafficPeriod }).then((r) => r.data),
  });

  const { data: topClients } = useQuery({
    queryKey: ['dashboard-top-clients'],
    queryFn: () => dashboardApi.getTopClients({ days: 7, limit: 6 }).then((r) => r.data),
  });

  const { data: recentAudit } = useQuery({
    queryKey: ['dashboard-recent-audit'],
    queryFn: () => dashboardApi.getRecentAudit({ limit: 6 }).then((r) => r.data),
  });

  const { data: nodes } = useQuery({
    queryKey: ['nodes-list'],
    queryFn: () => nodesApi.getAll().then((r) => r.data),
    refetchInterval: 30000,
  });

  const todayUp   = Number(overview?.traffic?.today?.upload   || 0);
  const todayDown = Number(overview?.traffic?.today?.download || 0);
  const monthUp   = Number(overview?.traffic?.month?.upload   || 0);
  const monthDown = Number(overview?.traffic?.month?.download || 0);

  const kpis = overview ? [
    {
      label: t('dashboard.totalClients'),
      value: overview.clients.total,
      sub: `${overview.clients.active} active · ${overview.clients.banned} banned`,
      icon: <Users size={16} />,
      accentColor: '#6366f1',
    },
    {
      label: t('dashboard.nodesOnline'),
      value: `${overview.nodes.online}/${overview.nodes.total}`,
      sub: `${overview.inbounds.total} inbounds configured`,
      icon: <Server size={16} />,
      accentColor: '#10b981',
    },
    {
      label: t('dashboard.todayTraffic'),
      value: formatBytes(todayUp + todayDown),
      sub: `↑ ${formatBytes(todayUp)} · ↓ ${formatBytes(todayDown)}`,
      icon: <Activity size={16} />,
      accentColor: '#38bdf8',
    },
    {
      label: t('dashboard.monthTraffic'),
      value: formatBytes(monthUp + monthDown),
      sub: `Expiring today: ${overview.expiringToday || 0}`,
      icon: <TrendingUp size={16} />,
      accentColor: '#f59e0b',
    },
  ] : [];

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-fg tracking-tight flex items-center gap-2">
            {t('dashboard.title')}
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-accent-muted text-accent border border-accent/20">
              Live Core
            </span>
          </h1>
          <p className="text-xs text-fg-muted mt-1">
            Real-time proxy fleet overview, active traffic and system health
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-fg-subtle px-3 py-1.5 rounded-xl bg-surface border border-border">
          <Clock size={13} className="text-accent" />
          <span>{new Date().toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <KPISkeleton key={i} />)}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <KPICard key={kpi.label} {...kpi} />
          ))}
        </div>
      ) : null}

      {/* Main Charts & Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TrafficChart data={trafficChart || []} period={trafficPeriod} onPeriodChange={setTrafficPeriod} />
        {nodes && <SystemHealthCard nodes={nodes} />}
      </div>

      {/* Bottom Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top Clients Ranking */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-fg tracking-tight">
                  {t('dashboard.topClients')}
                </h3>
                <p className="text-xs text-fg-subtle mt-0.5">Top consumers in past 7 days</p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-bg-sunken text-fg-subtle border border-border">
                7D
              </span>
            </div>
            <div className="space-y-3.5">
              {topClients && topClients.length > 0 ? (
                topClients.map((tc: any, i: number) => {
                  const total = Number(tc._sum?.upload || 0) + Number(tc._sum?.download || 0);
                  const max = Number(topClients[0]._sum?.upload || 0) + Number(topClients[0]._sum?.download || 0) || 1;
                  const pct = Math.min((total / max) * 100, 100);
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`w-5 font-mono font-bold ${i < 3 ? 'text-accent' : 'text-fg-subtle'}`}>
                          #{i + 1}
                        </span>
                        <span className="font-semibold text-fg flex-1 truncate">
                          {tc.client?.username || 'Unknown'}
                        </span>
                        <span className="font-mono text-fg-muted font-medium">
                          {formatBytes(total)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-bg-sunken rounded-full overflow-hidden border border-border/50">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-xs text-fg-subtle">
                  {t('dashboard.noData')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Audit Stream */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-fg tracking-tight">
                  {t('dashboard.recentActivity')}
                </h3>
                <p className="text-xs text-fg-subtle mt-0.5">Audit trail & admin operations</p>
              </div>
              <ArrowUpRight size={15} className="text-fg-subtle" />
            </div>
            <div className="space-y-3">
              {recentAudit && recentAudit.length > 0 ? (
                recentAudit.map((log: any) => {
                  const actionColor = ACTION_COLORS[log.action] || '#64748b';
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-2 rounded-xl hover:bg-surface/50 transition-colors">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0 shadow-sm"
                        style={{ background: actionColor, boxShadow: `0 0 6px ${actionColor}80` }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-fg truncate">
                          <strong className="text-fg font-semibold">{log.user?.username || 'System'}</strong>{' '}
                          <span style={{ color: actionColor }} className="font-bold font-mono text-[11px] uppercase">
                            {log.action}
                          </span>{' '}
                          <span className="text-fg-muted">{log.resource}</span>
                        </div>
                        <div className="text-[10px] text-fg-subtle mt-0.5 flex items-center gap-1.5">
                          <Clock size={10} />
                          <span>
                            {new Date(log.createdAt).toLocaleString('en', {
                              hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric'
                            })}
                          </span>
                          {log.ip && (
                            <>
                              <span>·</span>
                              <span className="font-mono">{log.ip}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-xs text-fg-subtle">
                  {t('dashboard.noActivity')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActionsPanel />
      </div>
    </div>
  );
}
