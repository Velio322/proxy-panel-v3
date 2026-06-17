import { useI18n } from '@/i18n';
import { Cpu, HardDrive, AlertTriangle, Zap } from 'lucide-react';

function HealthBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color =
    pct > 85 ? 'var(--danger)' :
    pct > 65 ? 'var(--warning)' :
    'var(--success)';
  const gradientColor =
    pct > 85 ? '#ef4444' :
    pct > 65 ? '#f59e0b' :
    '#10b981';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--fg-subtle)' }}>
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-[12px] font-semibold font-mono" style={{ color }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${gradientColor}aa, ${gradientColor})`,
          }}
        />
      </div>
    </div>
  );
}

export function SystemHealthCard({ nodes }: { nodes: any[] }) {
  const { t } = useI18n();
  const online = nodes.filter(n => n.status === 'ONLINE');
  const offline = nodes.filter(n => n.status !== 'ONLINE' && n.status !== 'MAINTENANCE');
  const maintenance = nodes.filter(n => n.status === 'MAINTENANCE');
  const avgCpu = online.length > 0
    ? online.reduce((s, n) => s + (n.cpuUsage || 0), 0) / online.length
    : 0;
  const avgMem = online.length > 0
    ? online.reduce((s, n) => s + (n.memUsage || 0), 0) / online.length
    : 0;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'ONLINE':      return { bg: 'var(--success-muted)', color: 'var(--success)', dot: 'online' };
      case 'ERROR':       return { bg: 'var(--danger-muted)',  color: 'var(--danger)',  dot: 'offline' };
      case 'MAINTENANCE': return { bg: 'var(--warning-muted)', color: 'var(--warning)', dot: 'warning' };
      default:            return { bg: 'var(--bg-sunken)',     color: 'var(--fg-muted)', dot: 'maint' };
    }
  };

  return (
    <div className="card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>
            {t('dashboard.systemHealth')}
          </h3>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            {t('dashboard.nodeCluster')}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{ background: 'var(--success-muted)', color: 'var(--success)', border: '1px solid var(--success-border)' }}>
          <span className="status-dot online" />
          {online.length}/{nodes.length} {t('dashboard.online')}
        </div>
      </div>

      {/* Health bars */}
      <div className="space-y-3 mb-4">
        <HealthBar label={t('dashboard.cpuAvg')} value={avgCpu} icon={<Cpu size={11} />} />
        <HealthBar label={t('dashboard.memoryAvg')} value={avgMem} icon={<HardDrive size={11} />} />
      </div>

      {/* Node list */}
      <div className="space-y-1" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
        {nodes.slice(0, 5).map((node) => {
          const s = getStatusStyle(node.status);
          return (
            <div key={node.id}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md"
              style={{ transition: 'background 120ms' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <span className={`status-dot ${s.dot}`} />
              <span className="text-[13px] font-medium flex-1 truncate" style={{ color: 'var(--fg)' }}>
                {node.name}
              </span>
              {node.country && (
                <span className="text-[10px]" title={node.country}>{node.country}</span>
              )}
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md"
                style={{ background: 'var(--bg-raised)', color: 'var(--fg-muted)' }}>
                {node.cpuUsage != null ? `${node.cpuUsage.toFixed(0)}%` : '—'}
              </span>
            </div>
          );
        })}
        {nodes.length > 5 && (
          <div className="text-[11px] text-center pt-1" style={{ color: 'var(--fg-subtle)' }}>
            +{nodes.length - 5} more nodes
          </div>
        )}
      </div>

      {/* Alerts */}
      {offline.length > 0 && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold"
          style={{
            background: 'var(--danger-muted)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
          }}>
          <AlertTriangle size={13} />
          {offline.length} node{offline.length > 1 ? 's' : ''} {t('dashboard.offline')}
        </div>
      )}
      {maintenance.length > 0 && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold"
          style={{
            background: 'var(--warning-muted)',
            border: '1px solid var(--warning-border)',
            color: 'var(--warning)',
          }}>
          <Zap size={13} />
          {maintenance.length} node{maintenance.length > 1 ? 's' : ''} in maintenance
        </div>
      )}
    </div>
  );
}
