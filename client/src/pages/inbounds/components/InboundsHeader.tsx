import { Network, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';

interface InboundsHeaderProps {
  totalEnabled: number;
  totalCount: number;
  protocolsCount: number;
  isFetching: boolean;
  onRefresh: () => void;
  onAdd: () => void;
}

export function InboundsHeader({ totalEnabled, totalCount, protocolsCount, isFetching, onRefresh, onAdd }: InboundsHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center shadow-lg shadow-fg-900/10">
          <Network size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-fg tracking-tight">{t('inbounds.title')}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-emerald-600">{totalEnabled}</span>
              <span className="text-fg-subtle font-medium">{t('common.active')}</span>
            </span>
            <span className="text-fg-subtle text-xs">•</span>
            <span className="text-xs text-fg-subtle font-medium">
              <span className="text-fg font-bold">{totalCount}</span> {t('common.total').toLowerCase()}
            </span>
            <span className="text-fg-subtle text-xs">•</span>
            <span className="text-xs text-fg-subtle font-medium">
              <span className="text-fg font-bold">{protocolsCount}</span> {t('clients.protocols').toLowerCase()}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {isFetching && (
          <div className="flex items-center gap-2 text-fg-subtle">
            <Loader2 size={14} className="animate-spin" />
          </div>
        )}
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg bg-surface border border-border text-fg-muted hover:text-fg hover:border-border transition-all shadow-sm active:scale-95"
          title={t('common.refresh')}
        >
          <RefreshCw size={16} />
        </button>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold shadow-md shadow-fg-900/10 transition-all active:scale-[0.98] ring-offset-2 focus:ring-2 focus:ring-fg"
        >
          <Plus size={16} /> {t('inbounds.addInbound')}
        </button>
      </div>
    </div>
  );
}
