import { Users, Plus, RefreshCw, UserCheck } from 'lucide-react';
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-sky-400 text-white shadow-lg shadow-indigo-500/25">
          <Users size={20} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-fg tracking-tight">{t('clients.title')}</h1>
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <span>Total: <strong className="text-fg font-semibold">{total}</strong></span>
            <span>·</span>
            <span className="flex items-center gap-1 text-emerald-500 font-medium">
              <UserCheck size={13} /> {activeCount} active
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {isFetching && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border text-fg-subtle text-xs">
            <RefreshCw size={12} className="animate-spin text-accent" />
            <span>Syncing</span>
          </div>
        )}
        <button
          onClick={onAdd}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-accent/25"
        >
          <Plus size={16} /> {t('clients.addClient')}
        </button>
      </div>
    </div>
  );
}
