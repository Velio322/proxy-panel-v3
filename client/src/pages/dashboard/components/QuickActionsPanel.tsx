import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { Plus, Server, Settings, ArrowRight, Users, Network } from 'lucide-react';

const ACTIONS = [
  {
    labelKey: 'clients.addClient',
    icon: Users,
    path: '/clients',
    color: 'var(--accent)',
    desc: 'Create new client',
  },
  {
    labelKey: 'nodes.addNode',
    icon: Server,
    path: '/nodes',
    color: 'var(--success)',
    desc: 'Register a node',
  },
  {
    labelKey: 'nav.inbounds',
    icon: Network,
    path: '/inbounds',
    color: '#06b6d4',
    desc: 'Manage inbounds',
  },
  {
    labelKey: 'nav.settings',
    icon: Settings,
    path: '/settings',
    color: 'var(--fg-muted)',
    desc: 'Configure panel',
  },
];

export function QuickActionsPanel() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="card p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>
          {t('dashboard.quickActions')}
        </h3>
        <Plus size={14} style={{ color: 'var(--fg-subtle)' }} />
      </div>

      <div className="space-y-2 flex-1">
        {ACTIONS.map((a) => (
          <button
            key={a.path}
            onClick={() => navigate(a.path)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left"
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${a.color}40`;
              e.currentTarget.style.background = 'var(--surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '';
              e.currentTarget.style.background = 'var(--bg-raised)';
            }}>
            {/* Icon */}
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              style={{ background: `${a.color}18`, color: a.color }}>
              <a.icon size={14} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold" style={{ color: 'var(--fg)' }}>
                {t(a.labelKey)}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>
                {a.desc}
              </div>
            </div>

            <ArrowRight size={12} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}
