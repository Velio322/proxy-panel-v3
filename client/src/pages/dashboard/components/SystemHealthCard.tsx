import { useI18n } from '@/i18n';
import { Cpu, HardDrive, AlertTriangle } from 'lucide-react';

function HealthBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const isHigh = pct > 85;
  const isMed = pct > 65;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-xs font-semibold">
        <div className="flex items-center gap-1.5 text-fg-muted">
          {icon}
          <span>{label}</span>
        </div>
        <span className={`font-mono ${isHigh ? 'text-danger font-bold' : isMed ? 'text-amber-400' : 'text-emerald-400'}`}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-2 bg-bg-sunken rounded-full overflow-hidden border border-border/50">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isHigh ? 'bg-danger' : isMed ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SystemHealthCard({ nodes }: { nodes: any[] }) {
  const { t } = useI18n();
  const online = nodes.filter(n => n.status === 'ONLINE');
  const offline = nodes.filter(n => n.status !== 'ONLINE' && n.status !== 'MAINTENANCE');
  const avgCpu = online.length > 0
    ? online.reduce((s, n) => s + (n.cpuUsage || 0), 0) / online.length
    : 0;
  const avgMem = online.length > 0
    ? online.reduce((s, n) => s + (n.memUsage || 0), 0) / online.length
    : 0;

  return (
    <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-fg tracking-tight">
              {t('dashboard.systemHealth')}
            </h3>
            <p className="text-xs text-fg-subtle mt-0.5">
              Node cluster telemetry & resources
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{online.length}/{nodes.length} Online</span>
          </div>
        </div>

        {/* Health bars */}
        <div className="space-y-4 mb-5">
          <HealthBar label={t('dashboard.cpuAvg')} value={avgCpu} icon={<Cpu size={14} className="text-indigo-400" />} />
          <HealthBar label={t('dashboard.memoryAvg')} value={avgMem} icon={<HardDrive size={14} className="text-sky-400" />} />
        </div>
      </div>

      {/* Node list */}
      <div className="space-y-1.5 pt-3 border-t border-border">
        <div className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider mb-2">Active Cluster Nodes</div>
        {nodes.slice(0, 4).map((node) => {
          const isNodeOnline = node.status === 'ONLINE';
          return (
            <div
              key={node.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-surface/60 border border-border/50 hover:bg-surface-hover transition-colors"
            >
              <span className={`w-2 h-2 rounded-full ${isNodeOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-danger'}`} />
              <span className="text-xs font-bold text-fg flex-1 truncate">
                {node.name}
              </span>
              <span className="text-[11px] font-mono text-fg-muted px-2 py-0.5 rounded-md bg-bg-sunken border border-border">
                {node.cpuUsage != null ? `${node.cpuUsage.toFixed(0)}% CPU` : '0%'}
              </span>
            </div>
          );
        })}
        {nodes.length > 4 && (
          <div className="text-xs text-center text-fg-subtle pt-1">
            +{nodes.length - 4} more active nodes
          </div>
        )}
      </div>

      {/* Alerts */}
      {offline.length > 0 && (
        <div className="mt-3 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-danger-muted text-danger border border-danger/20">
          <AlertTriangle size={14} />
          <span>{offline.length} node{offline.length > 1 ? 's' : ''} offline</span>
        </div>
      )}
    </div>
  );
}
