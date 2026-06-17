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
  LOGIN:  'var(--success)',
  LOGOUT: 'var(--fg-subtle)',
  CREATE: 'var(--accent)',
  UPDATE: 'var(--warning)',
  DELETE: 'var(--danger)',
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
      sub: `${overview.clients.active} active, ${overview.clients.banned} banned`,
      icon: <Users size={15} />,
      accentColor: 'var(--accent)',
    },
    {
      label: t('dashboard.nodesOnline'),
      value: `${overview.nodes.online}/${overview.nodes.total}`,
      sub: `${overview.inbounds.total} inbounds configured`,
      icon: <Server size={15} />,
      accentColor: 'var(--success)',
    },
    {
      label: t('dashboard.todayTraffic'),
      value: formatBytes(todayUp + todayDown),
      sub: `↑ ${formatBytes(todayUp)} · ↓ ${formatBytes(todayDown)}`,
      icon: <Activity size={15} />,
      accentColor: '#06b6d4',
    },
    {
      label: t('dashboard.monthTraffic'),
      value: formatBytes(monthUp + monthDown),
      sub: `Expiring today: ${overview.expiringToday || 0}`,
      icon: <TrendingUp size={15} />,
      accentColor: 'var(--accent-2)',
    },
  ] : [];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: 'var(--fg)' }}>
            {t('dashboard.title')}
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[12px]"
          style={{ color: 'var(--fg-muted)' }}>
          <Clock size={13} />
          {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <KPISkeleton key={i} />)}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <KPICard key={kpi.label} {...kpi} />
          ))}
        </div>
      ) : null}

      {/* Chart + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TrafficChart data={trafficChart || []} period={trafficPeriod} onPeriodChange={setTrafficPeriod} />
        {nodes && <SystemHealthCard nodes={nodes} />}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Top Clients */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>
              {t('dashboard.topClients')}
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--bg-raised)', color: 'var(--fg-subtle)', border: '1px solid var(--border)' }}>
              7D
            </span>
          </div>
          <div className="space-y-3">
            {topClients && topClients.length > 0
              ? topClients.map((tc: any, i: number) => {
                const total = Number(tc._sum?.upload || 0) + Number(tc._sum?.download || 0);
                const max = Number(topClients[0]._sum?.upload || 0) + Number(topClients[0]._sum?.download || 0) || 1;
                const pct = (total / max) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold w-4 shrink-0"
                        style={{ color: i < 3 ? 'var(--accent)' : 'var(--fg-subtle)' }}>
                        {i + 1}
                      </span>
                      <span className="text-[13px] font-medium flex-1 truncate" style={{ color: 'var(--fg)' }}>
                        {tc.client?.username || 'Unknown'}
                      </span>
                      <span className="text-[11px] font-mono shrink-0" style={{ color: 'var(--fg-muted)' }}>
                        {formatBytes(total)}
                      </span>
                    </div>
                    <div className="ml-6 progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
              : (
                <div className="py-6 text-center text-[13px]" style={{ color: 'var(--fg-subtle)' }}>
                  {t('dashboard.noData')}
                </div>
              )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>
              {t('dashboard.recentActivity')}
            </h3>
            <ArrowUpRight size={14} style={{ color: 'var(--fg-subtle)' }} />
          </div>
          <div className="space-y-3">
            {recentAudit && recentAudit.length > 0
              ? recentAudit.map((log: any) => {
                const actionColor = ACTION_COLORS[log.action] || 'var(--fg-subtle)';
                return (
                  <div key={log.id} className="flex items-start gap-2.5">
                    <div className="mt-1.5 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: actionColor }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px]" style={{ color: 'var(--fg)' }}>
                        <span className="font-semibold">{log.user?.username || 'System'}</span>
                        {' '}
                        <span className="font-medium lowercase" style={{ color: actionColor }}>{log.action}</span>
                        {' '}
                        <span style={{ color: 'var(--fg-muted)' }}>{log.resource}</span>
                      </div>
                      <div className="text-[11px] mt-0.5 flex items-center gap-1.5"
                        style={{ color: 'var(--fg-subtle)' }}>
                        <Clock size={10} />
                        {new Date(log.createdAt).toLocaleString('en', {
                          hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric'
                        })}
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
              : (
                <div className="py-6 text-center text-[13px]" style={{ color: 'var(--fg-subtle)' }}>
                  {t('dashboard.noActivity')}
                </div>
              )}
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActionsPanel />
      </div>
    </div>
  );
}
