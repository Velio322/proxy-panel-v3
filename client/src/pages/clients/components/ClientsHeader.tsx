import { Users, Plus, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n';

interface ClientsHeaderProps {
  total: number;
  activeCount: number;
  isFetching: boolean;
  onAdd: () => void;
}

export function ClientsHeader({ total, activeCount, isFetching, onAdd }: ClientsHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-fg-900/10" style={{ background: 'var(--surface-invert)' }}>
          <Users size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-fg tracking-tight">{t('clients.title')}</h1>
          <p className="text-xs text-fg-muted font-medium">
            {t('clients.subtitle', { total: String(total), active: String(activeCount) })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {isFetching && (
          <div className="flex items-center gap-2 text-fg-subtle animate-pulse">
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Syncing</span>
          </div>
        )}
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-bold shadow-md shadow-fg-900/10 transition-all active:scale-[0.98] ring-offset-2 focus:ring-2 focus:ring-fg" style={{ background: 'var(--surface-invert)', color: 'var(--fg-invert)' }}
        >
          <Plus size={16} /> {t('clients.addClient')}
        </button>
      </div>
    </div>
  );
}
