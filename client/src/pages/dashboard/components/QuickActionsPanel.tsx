import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { Plus, Server, ArrowRight, Users, Network, Activity } from 'lucide-react';

const ACTIONS = [
  {
    labelKey: 'clients.addClient',
    icon: Users,
    path: '/clients',
    color: '#6366f1',
    desc: 'Create and provision new VPN client',
  },
  {
    labelKey: 'nodes.addNode',
    icon: Server,
    path: '/nodes',
    color: '#10b981',
    desc: 'Register a new remote proxy node',
  },
  {
    labelKey: 'nav.inbounds',
    icon: Network,
    path: '/inbounds',
    color: '#38bdf8',
    desc: 'Configure ports and Reality protocols',
  },
  {
    labelKey: 'nav.monitoring',
    icon: Activity,
    path: '/monitoring',
    color: '#f59e0b',
    desc: 'Inspect live traffic and node latency',
  },
];

export function QuickActionsPanel() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-fg tracking-tight">
            {t('dashboard.quickActions')}
          </h3>
          <p className="text-xs text-fg-subtle mt-0.5">Frequent management workflows</p>
        </div>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-accent-muted text-accent">
          <Plus size={16} />
        </div>
      </div>

      <div className="space-y-2.5 flex-1">
        {ACTIONS.map((a) => (
          <button
            key={a.path}
            onClick={() => navigate(a.path)}
            className="w-full flex items-center gap-3.5 p-3 rounded-xl bg-surface/70 border border-border hover:border-accent/40 hover:bg-surface-hover transition-all text-left group shadow-sm"
          >
            {/* Icon */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105"
              style={{ background: `${a.color}15`, color: a.color, border: `1px solid ${a.color}30` }}
            >
              <a.icon size={16} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-fg group-hover:text-accent transition-colors">
                {t(a.labelKey)}
              </div>
              <div className="text-[11px] text-fg-subtle truncate">
                {a.desc}
              </div>
            </div>

            <ArrowRight size={14} className="text-fg-subtle group-hover:text-fg group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
