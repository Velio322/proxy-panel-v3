import { Client } from '@/lib/api';
import { useI18n } from '@/i18n';
import { ClientRow } from './ClientRow';
import { Users, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

interface ClientsTableProps {
  clients: Client[];
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  total: number;
  onSub: (c: Client) => void;
  onEdit: (c: Client) => void;
  onBan: (id: string) => void;
  onDelete: (c: Client) => void;
  onResetTraffic: (id: string) => void;
  onAdd: () => void;
  isLoading?: boolean;
}

export function ClientsTable({
  clients, page, setPage, totalPages, total,
  onSub, onEdit, onBan, onDelete, onResetTraffic, onAdd,
  isLoading
}: ClientsTableProps) {
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="bg-surface/80 border border-border rounded-2xl p-16 flex items-center justify-center shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-accent/20 border-t-accent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-fg-subtle">Loading clients...</span>
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="bg-surface/80 border border-border rounded-2xl p-16 text-center shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-bg-raised border border-border flex items-center justify-center mb-4 text-fg-subtle">
          <Users size={28} />
        </div>
        <h3 className="text-sm font-bold text-fg">{t('clients.noClients')}</h3>
        <p className="text-xs text-fg-muted mt-1 mb-6 max-w-sm mx-auto">{t('clients.noClientsDesc')}</p>
        <button onClick={onAdd} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-accent/25">
          <Plus size={15} /> {t('clients.createFirst')}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface/80 border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border/80 bg-bg-raised/40 text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
              <th className="px-5 py-3.5 font-bold">{t('clients.title')}</th>
              <th className="px-5 py-3.5 font-bold">{t('clients.protocols')}</th>
              <th className="px-5 py-3.5 font-bold">{t('clients.traffic')}</th>
              <th className="px-5 py-3.5 font-bold">{t('clients.expiry')}</th>
              <th className="px-5 py-3.5 font-bold">{t('common.status')}</th>
              <th className="px-5 py-3.5 font-bold text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {clients.map((c) => (
              <ClientRow
                key={c.id}
                client={c}
                onSub={() => onSub(c)}
                onEdit={() => onEdit(c)}
                onBan={() => onBan(c.id)}
                onDelete={() => onDelete(c)}
                onResetTraffic={() => onResetTraffic(c.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border/70 bg-bg-raised/30">
          <span className="text-xs text-fg-muted">
            {t('clients.results', { total: String(total), page: String(page), pages: String(totalPages) })}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="p-2 rounded-xl bg-surface border border-border text-xs text-fg-muted hover:text-fg hover:bg-surface-hover disabled:opacity-40 shadow-sm transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-mono px-3 py-1 text-fg-muted">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-xl bg-surface border border-border text-xs text-fg-muted hover:text-fg hover:bg-surface-hover disabled:opacity-40 shadow-sm transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
