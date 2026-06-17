import { Client } from '@/lib/api';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { ClientRow } from './ClientRow';
import { Users } from 'lucide-react';

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
      <div className="bg-surface border border-border rounded-xl p-20 flex items-center justify-center shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-border-subtle rounded-full animate-spin" style={{ borderTopColor: 'var(--surface-invert)' }} />
          <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest">Loading data...</span>
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-16 text-center shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-bg-raised border border-border-subtle flex items-center justify-center mb-6">
          <Users size={28} className="text-fg-subtle" />
        </div>
        <h3 className="text-sm font-bold text-fg">{t('clients.noClients')}</h3>
        <p className="text-xs text-fg-muted mt-1.5 mb-6 max-w-xs mx-auto leading-relaxed">{t('clients.noClientsDesc')}</p>
        <button onClick={onAdd} className="px-6 py-2 rounded-lg text-white text-xs font-bold transition-all shadow-md active:scale-95" style={{ background: 'var(--surface-invert)', color: 'var(--fg-invert)' }}>
          {t('clients.createFirst')}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-raised/50 text-[10px] uppercase tracking-widest font-bold text-fg-subtle">
              <th className="text-left px-4 py-3 font-bold">{t('clients.title')}</th>
              <th className="text-left px-4 py-3 font-bold">{t('clients.protocols')}</th>
              <th className="text-left px-4 py-3 font-bold">{t('clients.traffic')}</th>
              <th className="text-left px-4 py-3 font-bold">{t('clients.expiry')}</th>
              <th className="text-left px-4 py-3 font-bold">{t('common.status')}</th>
              <th className="text-right px-4 py-3 font-bold">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle bg-bg-raised/30">
          <span className="text-xs font-medium text-fg-muted">
            {t('clients.results', { total: String(total), page: String(page), pages: String(totalPages) })}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-md bg-surface border border-border text-xs font-bold text-fg-muted hover:bg-bg-raised disabled:opacity-40 shadow-sm transition-all"
            >
              ←
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    "w-8 h-8 rounded-md text-xs font-bold transition-all shadow-sm border",
                    p === page 
                      ? "border-fg text-white"
                      : "bg-surface border-border text-fg-muted hover:bg-bg-raised"
                  )}
                  style={p === page ? { background: 'var(--surface-invert)', color: 'var(--fg-invert)' } : undefined}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-md bg-surface border border-border text-xs font-bold text-fg-muted hover:bg-bg-raised disabled:opacity-40 shadow-sm transition-all"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
